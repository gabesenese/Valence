import Groq from 'groq-sdk';
import { prisma } from '../../infrastructure/database';
import { startOfMonth } from 'date-fns';


export type ScenarioType =
  | 'occupancy_drop'
  | 'tenant_departure'
  | 'expense_increase'
  | 'acquisition'
  | 'rent_increase';

export interface SimulationRequest {
  scenario: ScenarioType;
  params:   ScenarioParams;
}

export type ScenarioParams =
  | OccupancyDropParams
  | TenantDepartureParams
  | ExpenseIncreaseParams
  | AcquisitionParams
  | RentIncreaseParams;

export interface OccupancyDropParams    { percentageDrop: number; propertyId?: string }
export interface TenantDepartureParams  { tenantId: string }
export interface ExpenseIncreaseParams  { percentageIncrease: number; category?: string; propertyId?: string }
export interface AcquisitionParams      { units: number; monthlyRevenue: number; monthlyExpenses: number; propertyName: string }
export interface RentIncreaseParams     { percentageIncrease: number; propertyId?: string }

export interface SimulationResult {
  scenario:        ScenarioType;
  scenarioLabel:   string;
  params:          ScenarioParams;
  current: {
    monthlyRevenue:  number;
    monthlyExpenses: number;
    noi:             number;
    occupancyRate:   number;
    totalUnits:      number;
    activeLeases:    number;
  };
  projected: {
    monthlyRevenue:  number;
    monthlyExpenses: number;
    noi:             number;
    occupancyRate:   number;
  };
  impact: {
    revenueChange:    number;
    revenueChangePct: number;
    expenseChange:    number;
    noiChange:        number;
    noiChangePct:     number;
    occupancyChange:  number;
    estimatedAnnualImpact: number;
  };
  analysis: {
    findings:        string[];
    recommendations: string[];
    riskFactors:     string[];
    timeToImpact:    string;
    confidence:      'high' | 'medium' | 'low';
  };
  computedAt: string;
}


async function getCurrentState(userId: string, propertyId?: string) {
  const now        = new Date();
  const monthStart = startOfMonth(now);

  const propertyFilter    = propertyId ? { id: propertyId, ownerId: userId } : { ownerId: userId };
  const financialFilter   = propertyId
    ? { propertyId, property: { ownerId: userId } }
    : { property: { ownerId: userId } };

  const [properties, revAgg, expAgg, leaseAgg] = await Promise.all([
    prisma.property.findMany({
      where: { status: 'ACTIVE', deletedAt: null, ...propertyFilter },
      select: { totalUnits: true, _count: { select: { leases: { where: { status: 'ACTIVE', deletedAt: null } } } } },
    }),
    prisma.financialRecord.aggregate({
      where: { ...financialFilter, type: 'REVENUE', periodStart: { gte: monthStart }, status: { not: 'VOID' } },
      _sum: { amount: true },
    }),
    prisma.financialRecord.aggregate({
      where: { ...financialFilter, type: 'EXPENSE', periodStart: { gte: monthStart }, status: { not: 'VOID' } },
      _sum: { amount: true },
    }),
    prisma.lease.aggregate({
      where: {
        status: 'ACTIVE', deletedAt: null,
        property: { ownerId: userId, ...(propertyId ? { id: propertyId } : {}) },
      },
      _sum: { baseRent: true },
      _count: true,
    }),
  ]);

  const totalUnits     = properties.reduce((s, p) => s + p.totalUnits, 0);
  const occupiedUnits  = properties.reduce((s, p) => s + p._count.leases, 0);
  const monthlyRevenue  = Number(revAgg._sum.amount ?? 0) || Number(leaseAgg._sum.baseRent ?? 0);
  const monthlyExpenses = Number(expAgg._sum.amount ?? 0);

  return {
    monthlyRevenue,
    monthlyExpenses,
    noi: monthlyRevenue - monthlyExpenses,
    occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
    totalUnits,
    activeLeases: leaseAgg._count,
    occupiedUnits,
  };
}


async function calcOccupancyDrop(
  params: OccupancyDropParams,
  state: Awaited<ReturnType<typeof getCurrentState>>,
) {
  const lostUnits      = Math.round(state.totalUnits * (params.percentageDrop / 100));
  const avgRentPerLease = state.activeLeases > 0 ? state.monthlyRevenue / state.activeLeases : 0;
  const revChange      = -(lostUnits * avgRentPerLease);
  const newOccupancy   = Math.max(0, state.occupancyRate - params.percentageDrop);
  return { revChange, expChange: 0, newOccupancy };
}

async function calcTenantDeparture(params: TenantDepartureParams, userId: string) {
  if (!params.tenantId) return { revChange: 0, expChange: 0, newOccupancyDelta: 0, tenantName: 'Unknown' };
  const lease = await prisma.lease.findFirst({
    where: {
      tenantId: params.tenantId,
      status: 'ACTIVE',
      deletedAt: null,
      property: { ownerId: userId }, // enforce ownership
    },
    include: {
      tenant:   { select: { name: true } },
      property: { select: { totalUnits: true, name: true } },
    },
  });
  if (!lease) return { revChange: 0, expChange: 0, newOccupancyDelta: 0, tenantName: 'Unknown' };

  const revChange      = -Number(lease.baseRent);
  const occupancyDelta = lease.property.totalUnits > 0
    ? -(1 / lease.property.totalUnits) * 100
    : 0;
  return { revChange, expChange: 0, newOccupancyDelta: occupancyDelta, tenantName: lease.tenant.name };
}

function calcExpenseIncrease(
  params: ExpenseIncreaseParams,
  state: Awaited<ReturnType<typeof getCurrentState>>,
) {
  const base      = state.monthlyExpenses || state.monthlyRevenue * 0.35; // estimate if no records
  const expChange = base * (params.percentageIncrease / 100);
  return { revChange: 0, expChange };
}

function calcAcquisition(params: AcquisitionParams) {
  return {
    revChange:    params.monthlyRevenue,
    expChange:    params.monthlyExpenses,
    unitsAdded:   params.units,
    occupancyDelta: 0,
  };
}

function calcRentIncrease(
  params: RentIncreaseParams,
  state: Awaited<ReturnType<typeof getCurrentState>>,
) {
  const revChange = state.monthlyRevenue * (params.percentageIncrease / 100);
  return { revChange, expChange: 0 };
}


let _client: Groq | null = null;
function getClient() {
  if (!_client) _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _client;
}

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  occupancy_drop:   'Occupancy Drop',
  tenant_departure: 'Tenant Departure',
  expense_increase: 'Expense Increase',
  acquisition:      'Property Acquisition',
  rent_increase:    'Rent Increase',
};

async function generateAnalysis(
  scenario: ScenarioType,
  params: ScenarioParams,
  current: SimulationResult['current'],
  projected: SimulationResult['projected'],
  impact: SimulationResult['impact'],
): Promise<SimulationResult['analysis']> {
  const prompt = `You are a commercial real estate portfolio analyst.
A property manager is running a scenario simulation to understand the financial impact of a change.

Scenario: ${SCENARIO_LABELS[scenario]}
Parameters: ${JSON.stringify(params, null, 2)}

Current Portfolio State:
- Monthly Revenue: $${current.monthlyRevenue.toLocaleString()}
- Monthly Expenses: $${current.monthlyExpenses.toLocaleString()}
- NOI: $${current.noi.toLocaleString()}
- Occupancy: ${current.occupancyRate.toFixed(1)}%
- Active Leases: ${current.activeLeases}

Projected State After Scenario:
- Monthly Revenue: $${projected.monthlyRevenue.toLocaleString()}
- Monthly Expenses: $${projected.monthlyExpenses.toLocaleString()}
- NOI: $${projected.noi.toLocaleString()}
- Occupancy: ${projected.occupancyRate.toFixed(1)}%

Financial Impact:
- Revenue Change: ${impact.revenueChange >= 0 ? '+' : ''}$${Math.abs(impact.revenueChange).toLocaleString()} (${impact.revenueChangePct >= 0 ? '+' : ''}${impact.revenueChangePct.toFixed(1)}%)
- NOI Change: ${impact.noiChange >= 0 ? '+' : ''}$${Math.abs(impact.noiChange).toLocaleString()} (${impact.noiChangePct >= 0 ? '+' : ''}${impact.noiChangePct.toFixed(1)}%)
- Annualized Impact: ${impact.estimatedAnnualImpact >= 0 ? '+' : ''}$${Math.abs(impact.estimatedAnnualImpact).toLocaleString()}

Provide a concise, expert analysis using the EXACT dollar figures above. Every finding must reference the specific numbers provided. Focus on what the operator should actually do.`;

  const response = await getClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    tools: [{
      type: 'function',
      function: {
        name: 'scenario_analysis',
        description: 'Structured analysis of a real estate scenario simulation',
        parameters: {
          type: 'object',
          required: ['findings', 'recommendations', 'riskFactors', 'timeToImpact', 'confidence'],
          properties: {
            findings: {
              type: 'array',
              items: { type: 'string' },
              description: '3-4 key findings. Must use the exact dollar figures and percentages from the prompt.',
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' },
              description: '3-4 concrete, specific action steps. Reference the actual numbers.',
            },
            riskFactors: {
              type: 'array',
              items: { type: 'string' },
              description: '2-3 secondary risks specific to this scenario and these numbers.',
            },
            timeToImpact: {
              type: 'string',
              description: 'When the impact fully materialises. E.g. "Immediate", "1-3 months"',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Confidence level based on available data completeness.',
            },
          },
        },
      },
    }],
    tool_choice: { type: 'function', function: { name: 'scenario_analysis' } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error('No tool call returned from AI');
  }

  return JSON.parse(toolCall.function.arguments) as SimulationResult['analysis'];
}


function buildFallbackAnalysis(
  scenario: ScenarioType,
  impact: SimulationResult['impact'],
  current: SimulationResult['current'],
  projected: SimulationResult['projected'],
): SimulationResult['analysis'] {
  const fmt   = (n: number) => `$${Math.abs(n).toLocaleString()}`;
  const sign  = (n: number) => n >= 0 ? '+' : '-';
  const pct   = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  const findings: string[] = [
    `${SCENARIO_LABELS[scenario]} reduces monthly revenue by ${fmt(impact.revenueChange)} (${pct(impact.revenueChangePct)})`,
    `NOI moves from ${fmt(current.noi)} to ${fmt(projected.noi)}/mo — a ${fmt(impact.noiChange)} change (${pct(impact.noiChangePct)})`,
    `Annualised impact: ${sign(impact.estimatedAnnualImpact)}${fmt(impact.estimatedAnnualImpact)}/year`,
  ];

  if (impact.occupancyChange !== 0) {
    findings.push(`Occupancy shifts from ${current.occupancyRate.toFixed(1)}% to ${projected.occupancyRate.toFixed(1)}%`);
  }

  const recommendations: string[] = [];
  const riskFactors: string[] = [];
  let timeToImpact = 'Immediate to 3 months';

  switch (scenario) {
    case 'tenant_departure':
      recommendations.push(
        `Begin replacement tenant outreach immediately to close the ${fmt(impact.revenueChange)}/mo gap`,
        `Review lease terms for early-termination clauses or penalties`,
        `Assess whether the vacancy can be split or re-configured to improve marketability`,
      );
      riskFactors.push(
        `Extended vacancy could push annualised loss beyond ${fmt(impact.estimatedAnnualImpact)}`,
        `Neighbouring tenants may cite vacancy as grounds for rent negotiations`,
      );
      timeToImpact = 'Immediate';
      break;

    case 'occupancy_drop':
      recommendations.push(
        `Review pricing strategy — a ${fmt(impact.revenueChange)}/mo shortfall suggests rents may need adjusting`,
        `Identify the ${current.totalUnits - projected.occupancyRate / 100 * current.totalUnits | 0} at-risk units and prioritise lease renewals`,
        `Ensure operating reserves cover at least 3 months of the ${fmt(impact.revenueChange)} gap`,
      );
      riskFactors.push(
        `Further occupancy erosion could amplify impact beyond ${fmt(impact.estimatedAnnualImpact)}/year`,
        `Lower occupancy signals may affect property valuation and financing terms`,
      );
      timeToImpact = '1–3 months';
      break;

    case 'expense_increase':
      recommendations.push(
        `Audit the largest expense categories to identify where the ${fmt(impact.expenseChange)}/mo increase originates`,
        `Negotiate multi-year contracts with vendors before increases take effect`,
        `Review CAM recovery clauses in leases — tenants may absorb a portion`,
      );
      riskFactors.push(
        `If revenue stays flat, the ${fmt(impact.noiChange)}/mo NOI compression compounds annually`,
        `Expense inflation often precedes insurance and tax reassessments`,
      );
      timeToImpact = '1–6 months';
      break;

    default:
      recommendations.push(
        `Validate projected ${fmt(Math.abs(impact.revenueChange))}/mo revenue change against market comparables`,
        `Stress-test NOI at ${fmt(projected.noi)}/mo against your debt service coverage requirements`,
        `Update financial models and inform stakeholders of the ${pct(impact.revenueChangePct)} revenue shift`,
      );
      riskFactors.push(
        `Market conditions may accelerate or delay the projected ${fmt(impact.estimatedAnnualImpact)} annual impact`,
        `Secondary operating cost effects not captured in this model`,
      );
  }

  return {
    findings,
    recommendations,
    riskFactors,
    timeToImpact,
    confidence: 'medium',
  };
}


export async function runSimulation(req: SimulationRequest, userId: string): Promise<SimulationResult> {
  const propertyId = 'propertyId' in req.params
    ? (req.params as { propertyId?: string }).propertyId
    : undefined;

  const state = await getCurrentState(userId, propertyId);

  let revChange = 0;
  let expChange = 0;
  let occDelta  = 0;

  switch (req.scenario) {
    case 'occupancy_drop': {
      const p = req.params as OccupancyDropParams;
      const r = await calcOccupancyDrop(p, state);
      revChange = r.revChange; expChange = r.expChange;
      occDelta  = -p.percentageDrop;
      break;
    }
    case 'tenant_departure': {
      const r = await calcTenantDeparture(req.params as TenantDepartureParams, userId);
      revChange = r.revChange; expChange = r.expChange;
      occDelta  = ('newOccupancyDelta' in r) ? (r.newOccupancyDelta ?? 0) : 0;
      break;
    }
    case 'expense_increase': {
      const r = calcExpenseIncrease(req.params as ExpenseIncreaseParams, state);
      revChange = r.revChange; expChange = r.expChange;
      break;
    }
    case 'acquisition': {
      const r = calcAcquisition(req.params as AcquisitionParams);
      revChange = r.revChange; expChange = r.expChange;
      break;
    }
    case 'rent_increase': {
      const r = calcRentIncrease(req.params as RentIncreaseParams, state);
      revChange = r.revChange; expChange = r.expChange;
      break;
    }
  }

  const projRevenue   = state.monthlyRevenue  + revChange;
  const projExpenses  = state.monthlyExpenses + expChange;
  const projNOI       = projRevenue - projExpenses;
  const projOccupancy = Math.max(0, Math.min(100, state.occupancyRate + occDelta));

  const current = {
    monthlyRevenue:  state.monthlyRevenue,
    monthlyExpenses: state.monthlyExpenses,
    noi:             state.noi,
    occupancyRate:   Number(state.occupancyRate.toFixed(1)),
    totalUnits:      state.totalUnits,
    activeLeases:    state.activeLeases,
  };

  const projected = {
    monthlyRevenue:  Math.round(projRevenue),
    monthlyExpenses: Math.round(projExpenses),
    noi:             Math.round(projNOI),
    occupancyRate:   Number(projOccupancy.toFixed(1)),
  };

  const impact = {
    revenueChange:         Math.round(revChange),
    revenueChangePct:      state.monthlyRevenue > 0
      ? Number(((revChange / state.monthlyRevenue) * 100).toFixed(1)) : 0,
    expenseChange:         Math.round(expChange),
    noiChange:             Math.round(projNOI - state.noi),
    noiChangePct:          state.noi !== 0
      ? Number((((projNOI - state.noi) / Math.abs(state.noi)) * 100).toFixed(1)) : 0,
    occupancyChange:       Number(occDelta.toFixed(1)),
    estimatedAnnualImpact: Math.round((revChange - expChange) * 12),
  };

  let analysis: SimulationResult['analysis'];
  try {
    analysis = await generateAnalysis(req.scenario, req.params, current, projected, impact);
  } catch {
    analysis = buildFallbackAnalysis(req.scenario, impact, current, projected);
  }

  return {
    scenario:      req.scenario,
    scenarioLabel: SCENARIO_LABELS[req.scenario],
    params:        req.params,
    current,
    projected,
    impact,
    analysis,
    computedAt: new Date().toISOString(),
  };
}


export async function getActiveTenantsForSimulator(userId: string) {
  const leases = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      property: { ownerId: userId, deletedAt: null },
    },
    include: {
      tenant:   { select: { id: true, name: true } },
      property: { select: { name: true } },
    },
    orderBy: { baseRent: 'desc' },
  });
  return leases.map((l) => ({
    tenantId:    l.tenantId,
    tenantName:  l.tenant.name,
    propertyName: l.property.name,
    monthlyRent: Number(l.baseRent),
    leaseId:     l.id,
  }));
}
