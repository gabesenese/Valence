import { api, extractData } from './api';


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

export type LeaseFieldStatus = 'match' | 'mismatch' | 'missing_in_document';

export interface LeaseFieldComparison {
  field:     string;
  label:     string;
  stored:    string | null;
  extracted: string | null;
  status:    LeaseFieldStatus;
}

export interface LeaseVerificationResult {
  leaseId:       string;
  extracted:     ExtractedLease;
  comparisons:   LeaseFieldComparison[];
  matchCount:    number;
  mismatchCount: number;
  missingCount:  number;
}


export interface ExtractedProperty {
  name:          string | null;
  type:          'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED_USE' | 'INDUSTRIAL' | 'RETAIL' | 'OFFICE' | null;
  address:       string | null;
  city:          string | null;
  state:         string | null;
  zipCode:       string | null;
  totalUnits:    number | null;
  totalSqft:     number | null;
  yearBuilt:     number | null;
  purchasePrice: number | null;
  currentValue:  number | null;
}


export interface HealthScoreComponent {
  name:        string;
  score:       number;
  maxScore:    number;
  label:       string;
  description: string;
  delta:       number;
}

export interface ScoreDriver {
  name:  string;
  label: string;
  delta: number;
}

export interface PortfolioHealthScore {
  score:      number;
  delta:      number;
  trend:      'up' | 'down' | 'stable';
  band:       'critical' | 'at_risk' | 'stable' | 'healthy';
  provisional: boolean;
  components: HealthScoreComponent[];
  drivers: {
    positive: ScoreDriver[];
    negative: ScoreDriver[];
  };
  computedAt: string;
}


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

export interface SimulatorOptions {
  properties: { id: string; name: string; totalUnits: number; monthlyRevenue: number; monthlyExpenses: number }[];
  leases: { id: string; label: string; monthlyRent: number; propertyId: string }[];
  expenseCategories: string[];
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
  assumptions?: string[];
  computedAt: string;
}

export interface SimulatorTenant {
  tenantId:     string;
  tenantName:   string;
  propertyName: string;
  monthlyRent:  number;
  leaseId:      string;
}


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

  verifyLeaseDocument: (leaseId: string, file: File): Promise<LeaseVerificationResult> => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post(`/ai/leases/${leaseId}/verify-document`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 })
      .then(extractData<LeaseVerificationResult>);
  },

  applyExtractedLease: (leaseId: string, fields: Partial<ExtractedLease>): Promise<{ applied: string[] }> =>
    api.post(`/ai/leases/${leaseId}/apply-extracted`, { fields }).then(extractData<{ applied: string[] }>),

  extractProperty: (file: File): Promise<ExtractedProperty> => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/ai/extract-property', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 })
      .then(extractData<ExtractedProperty>);
  },

  getHealthScore: (): Promise<PortfolioHealthScore> =>
    api.get('/ai/health-score').then(extractData<PortfolioHealthScore>),

  runSimulation: (req: SimulationRequest): Promise<SimulationResult> =>
    api.post('/ai/simulate', req, { timeout: 120_000 }).then(extractData<SimulationResult>),

  getSimulatorTenants: (): Promise<SimulatorTenant[]> =>
    api.get('/ai/simulate/tenants').then(extractData<SimulatorTenant[]>),

  getSimulatorOptions: (): Promise<SimulatorOptions> =>
    api.get('/ai/simulate/options').then(extractData<SimulatorOptions>),
};
