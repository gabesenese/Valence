import { api, extractData } from './api';

// ─── Executive brief ──────────────────────────────────────────────────────────

export interface RiskItem {
  title:          string;
  description:    string;
  severity:       'critical' | 'high' | 'medium';
  monthlyRevenue?: number;
  leaseNumber?:   string;
  tenantName?:    string;
  daysRemaining?: number;
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

// ─── Extracted lease ──────────────────────────────────────────────────────────

export interface ExtractedLease {
  tenantName:      string | null;
  propertyAddress: string | null;
  unitNumber:      string | null;
  startDate:       string | null;
  endDate:         string | null;
  baseRent:        number | null;
  rentEscalation:  number | null;
  securityDeposit: number | null;
  sqft:            number | null;
  leaseType:       'GROSS' | 'NET' | 'MODIFIED_GROSS' | 'PERCENTAGE' | 'GROUND' | null;
  renewalOptions:  string | null;
  obligations:     string | null;
  notes:           string | null;
}

// ─── Health score ─────────────────────────────────────────────────────────────

export interface HealthScoreComponent {
  name:        string;
  score:       number;
  maxScore:    number;
  label:       string;
  description: string;
}

export interface PortfolioHealthScore {
  score:      number;
  delta:      number;
  trend:      'up' | 'down' | 'stable';
  band:       'critical' | 'at_risk' | 'stable' | 'healthy';
  components: HealthScoreComponent[];
  computedAt: string;
}

// ─── Scenario simulator ───────────────────────────────────────────────────────

export type ScenarioType =
  | 'occupancy_drop'
  | 'tenant_departure'
  | 'expense_increase'
  | 'acquisition'
  | 'rent_increase';

export interface SimulationRequest {
  scenario: ScenarioType;
  params:   Record<string, unknown>;
}

export interface SimulationResult {
  scenario:      ScenarioType;
  scenarioLabel: string;
  params:        Record<string, unknown>;
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
    revenueChange:         number;
    revenueChangePct:      number;
    expenseChange:         number;
    noiChange:             number;
    noiChangePct:          number;
    occupancyChange:       number;
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

export interface SimulatorTenant {
  tenantId:     string;
  tenantName:   string;
  propertyName: string;
  monthlyRent:  number;
  leaseId:      string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiService = {
  getExecutiveBrief: (): Promise<ExecutiveBrief> =>
    api.get('/ai/executive-brief', { timeout: 120_000 }).then(extractData<ExecutiveBrief>),

  extractLease: (file: File): Promise<ExtractedLease> => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/ai/extract-lease', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 })
      .then(extractData<ExtractedLease>);
  },

  getHealthScore: (): Promise<PortfolioHealthScore> =>
    api.get('/ai/health-score').then(extractData<PortfolioHealthScore>),

  runSimulation: (req: SimulationRequest): Promise<SimulationResult> =>
    api.post('/ai/simulate', req, { timeout: 120_000 }).then(extractData<SimulationResult>),

  getSimulatorTenants: (): Promise<SimulatorTenant[]> =>
    api.get('/ai/simulate/tenants').then(extractData<SimulatorTenant[]>),
};
