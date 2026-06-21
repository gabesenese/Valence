import Groq from 'groq-sdk';
import { prisma } from '../../infrastructure/database';
import { differenceInDays } from 'date-fns';


export interface RiskItem {
  title:       string;
  description: string;
  severity:    'critical' | 'high' | 'medium';
  monthlyRevenue?: number;
  leaseNumber?:    string;
  tenantName?:     string;
  daysRemaining?:  number;
}

export interface ActionItem {
  action:      string;
  context:     string;
  urgency:     'immediate' | 'this_week' | 'this_month';
  category:    'contact_tenant' | 'start_renewal' | 'send_document' | 'financial_review' | 'investigate';
  entityName?: string;
  leaseNumber?: string;
}

export interface ExecutiveBrief {
  generatedAt:     string;
  portfolioHealth: 'critical' | 'at_risk' | 'stable' | 'healthy';
  headline:        string;
  summary:         string;
  revenueRisk:     RiskItem[];
  actions:         ActionItem[];
}


async function gatherContext() {
  const now = new Date();

  const [leases, properties, criticalAlerts, flaggedFinancials] = await Promise.all([
    prisma.lease.findMany({
      where: { status: 'ACTIVE' },
      include: {
        property: { select: { name: true, code: true } },
        tenant:   { select: { name: true, email: true } },
        owner:    { select: { firstName: true, lastName: true } },
        alerts: {
          where: { status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
          select: { severity: true, type: true },
        },
      },
      orderBy: { endDate: 'asc' },
    }),
    prisma.property.findMany({
      where: { status: 'ACTIVE' },
      select: { totalUnits: true, _count: { select: { leases: { where: { status: 'ACTIVE' } } } } },
    }),
    prisma.alert.findMany({
      where: { severity: 'CRITICAL', status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
      include: {
        lease:    { select: { leaseNumber: true, tenant: { select: { name: true } } } },
        property: { select: { name: true } },
      },
      take: 15,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.financialRecord.findMany({
      where: { status: { in: ['FLAGGED', 'DISPUTED'] } },
      include: { lease: { select: { leaseNumber: true, tenant: { select: { name: true } } } } },
      take: 10,
    }),
  ]);

  const totalRevenue = leases.reduce((s, l) => s + Number(l.baseRent), 0);
  const totalUnits   = properties.reduce((s, p) => s + p.totalUnits, 0);
  const occupiedUnits = properties.reduce((s, p) => s + p._count.leases, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const expiring90  = leases.filter(l => differenceInDays(l.endDate, now) <= 90);
  const revenueAt90 = expiring90.reduce((s, l) => s + Number(l.baseRent), 0);
  const revenueAt30 = leases.filter(l => differenceInDays(l.endDate, now) <= 30)
    .reduce((s, l) => s + Number(l.baseRent), 0);

  return {
    portfolioSummary: {
      totalActiveLeases:     leases.length,
      totalMonthlyRevenue:   totalRevenue,
      occupancyRate,
      criticalAlertsOpen:    criticalAlerts.length,
      flaggedFinancialCount: flaggedFinancials.length,
    },
    expiringLeases: expiring90.map(l => ({
      leaseNumber:    l.leaseNumber,
      tenantName:     l.tenant.name,
      tenantEmail:    l.tenant.email,
      propertyName:   l.property.name,
      monthlyRent:    Number(l.baseRent),
      renewalRisk:    l.renewalRisk,
      renewalStage:   l.renewalStage,
      daysRemaining:  differenceInDays(l.endDate, now),
      hasRenewalDate: !!l.renewalDate,
      owner:          l.owner ? `${l.owner.firstName} ${l.owner.lastName}` : null,
      openAlerts:     l.alerts.filter(a => a.severity === 'CRITICAL').length,
    })),
    criticalAlerts: criticalAlerts.map(a => ({
      title:        a.title,
      type:         a.type,
      leaseRef:     a.lease ? `${a.lease.leaseNumber} (${a.lease.tenant.name})` : null,
      propertyName: a.property?.name ?? null,
    })),
    flaggedFinancials: flaggedFinancials.map(r => ({
      leaseNumber: r.lease?.leaseNumber ?? 'unknown',
      tenantName:  r.lease?.tenant.name ?? 'unknown',
      amount:      Number(r.amount),
      status:      r.status,
    })),
    financialMetrics: {
      revenueAtRiskIn30Days: revenueAt30,
      revenueAtRiskIn90Days: revenueAt90,
      percentageAtRisk:      totalRevenue > 0 ? Math.round((revenueAt90 / totalRevenue) * 100) : 0,
    },
  };
}


let _client: Groq | null = null;
function getClient() {
  if (!_client) _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _client;
}

function buildFallbackBrief(ctx: Awaited<ReturnType<typeof gatherContext>>): ExecutiveBrief {
  const { portfolioSummary, expiringLeases, criticalAlerts, flaggedFinancials, financialMetrics } = ctx;

  const health: ExecutiveBrief['portfolioHealth'] =
    portfolioSummary.criticalAlertsOpen >= 3 ? 'critical' :
    portfolioSummary.criticalAlertsOpen >= 1 || expiringLeases.some(l => l.daysRemaining <= 30) ? 'at_risk' :
    expiringLeases.length > 0 || portfolioSummary.flaggedFinancialCount > 0 ? 'stable' : 'healthy';

  const urgentLeases = expiringLeases.filter(l => l.daysRemaining <= 30);
  const headline = urgentLeases.length > 0
    ? `${urgentLeases.length} lease${urgentLeases.length > 1 ? 's' : ''} expiring within 30 days — $${urgentLeases.reduce((s, l) => s + l.monthlyRent, 0).toLocaleString()}/mo at risk`
    : portfolioSummary.criticalAlertsOpen > 0
      ? `${portfolioSummary.criticalAlertsOpen} critical alert${portfolioSummary.criticalAlertsOpen > 1 ? 's' : ''} require immediate attention`
      : `Portfolio at ${portfolioSummary.occupancyRate}% occupancy — $${portfolioSummary.totalMonthlyRevenue.toLocaleString()}/mo revenue`;

  const revenueRisk: RiskItem[] = [
    ...expiringLeases.slice(0, 3).map(l => ({
      title:         `Lease expiring: ${l.tenantName}`,
      description:   `${l.daysRemaining} days remaining — $${l.monthlyRent.toLocaleString()}/mo`,
      severity:      (l.daysRemaining <= 30 ? 'critical' : l.daysRemaining <= 60 ? 'high' : 'medium') as RiskItem['severity'],
      monthlyRevenue: l.monthlyRent,
      leaseNumber:   l.leaseNumber,
      tenantName:    l.tenantName,
      daysRemaining: l.daysRemaining,
    })),
    ...flaggedFinancials.slice(0, 2).map(f => ({
      title:       `Flagged payment: ${f.tenantName}`,
      description: `$${f.amount.toLocaleString()} — ${f.status.toLowerCase()}`,
      severity:    'high' as RiskItem['severity'],
      leaseNumber: f.leaseNumber,
      tenantName:  f.tenantName,
    })),
  ];

  const actions: ActionItem[] = [
    ...urgentLeases.slice(0, 3).map(l => ({
      action:      `Contact ${l.tenantName} to start renewal`,
      context:     `Lease ${l.leaseNumber} expires in ${l.daysRemaining} days — $${l.monthlyRent.toLocaleString()}/mo`,
      urgency:     (l.daysRemaining <= 30 ? 'immediate' : 'this_week') as ActionItem['urgency'],
      category:    'start_renewal' as ActionItem['category'],
      entityName:  l.tenantName,
      leaseNumber: l.leaseNumber,
    })),
    ...criticalAlerts.slice(0, 2).map(a => ({
      action:     `Investigate: ${a.title}`,
      context:    a.leaseRef ?? a.propertyName ?? '',
      urgency:    'immediate' as ActionItem['urgency'],
      category:   'investigate' as ActionItem['category'],
      entityName: a.leaseRef ?? a.propertyName ?? undefined,
    })),
  ];

  return {
    portfolioHealth: health,
    headline,
    summary: `Portfolio has ${portfolioSummary.totalActiveLeases} active leases at ${portfolioSummary.occupancyRate}% occupancy generating $${portfolioSummary.totalMonthlyRevenue.toLocaleString()}/mo. ${financialMetrics.revenueAtRiskIn30Days > 0 ? `$${financialMetrics.revenueAtRiskIn30Days.toLocaleString()}/mo at risk from leases expiring in 30 days.` : ''}`,
    revenueRisk,
    actions,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateExecutiveBrief(): Promise<ExecutiveBrief> {
  const ctx = await gatherContext();

  if (!process.env.GROQ_API_KEY) return buildFallbackBrief(ctx);

  const contextBlock = JSON.stringify(ctx, null, 2);

  try {
    const response = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `You are an executive intelligence assistant for Valence, a commercial real estate portfolio management platform.

Analyze this real-time portfolio snapshot and generate an executive brief. Be specific — use real tenant names, lease numbers, and dollar figures from the data. Every recommendation must be actionable and tied to real data.

<portfolio_snapshot>
${contextBlock}
</portfolio_snapshot>

Rules:
- Headline must include a specific dollar amount and the single most urgent action
- Never say "consider" — say exactly what to do
- Revenue risk items must mention the specific monthly revenue at stake
- Actions must be concrete: who to contact, what to do, why it matters now
- If a lease has daysRemaining <= 30 and no renewalDate, this is your top priority
- For flagged financials, name the tenant and amount
- portfolioHealth must be one of: critical, at_risk, stable, healthy
- urgency must be one of: immediate, this_week, this_month
- category must be one of: contact_tenant, start_renewal, send_document, financial_review, investigate`,
      }],
      tools: [{
        type: 'function',
        function: {
          name: 'generate_executive_brief',
          description: 'Generate a structured executive intelligence brief for a commercial real estate portfolio.',
          parameters: {
            type: 'object',
            required: ['portfolioHealth', 'headline', 'summary', 'revenueRisk', 'actions'],
            properties: {
              portfolioHealth: { type: 'string' },
              headline:        { type: 'string' },
              summary:         { type: 'string' },
              revenueRisk: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title:          { type: 'string' },
                    description:    { type: 'string' },
                    severity:       { type: 'string' },
                    monthlyRevenue: { type: 'number' },
                    leaseNumber:    { type: 'string' },
                    tenantName:     { type: 'string' },
                    daysRemaining:  { type: 'number' },
                  },
                },
              },
              actions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action:      { type: 'string' },
                    context:     { type: 'string' },
                    urgency:     { type: 'string' },
                    category:    { type: 'string' },
                    entityName:  { type: 'string' },
                    leaseNumber: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'generate_executive_brief' } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') return buildFallbackBrief(ctx);

    const r = JSON.parse(toolCall.function.arguments) as Omit<ExecutiveBrief, 'generatedAt'>;

    const validHealth   = new Set(['critical', 'at_risk', 'stable', 'healthy']);
    const validSeverity = new Set(['critical', 'high', 'medium']);
    const validUrgency  = new Set(['immediate', 'this_week', 'this_month']);
    const validCategory = new Set(['contact_tenant', 'start_renewal', 'send_document', 'financial_review', 'investigate']);
    const normalize     = (val: string, valid: Set<string>, fallback: string) =>
      valid.has(val?.toLowerCase()) ? val.toLowerCase() : fallback;

    return {
      ...r,
      portfolioHealth: normalize(r.portfolioHealth, validHealth, 'stable') as ExecutiveBrief['portfolioHealth'],
      revenueRisk: (r.revenueRisk ?? []).map(item => ({
        ...item,
        severity: normalize(item.severity, validSeverity, 'medium') as RiskItem['severity'],
      })),
      actions: (r.actions ?? []).map(item => ({
        ...item,
        urgency:  normalize(item.urgency,  validUrgency,   'this_month') as ActionItem['urgency'],
        category: normalize(item.category, validCategory,  'investigate') as ActionItem['category'],
      })),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return buildFallbackBrief(ctx);
  }
}
