import { api, extractData, extractPaginated, type PaginatedResult } from './api';

export interface FinancialRecord {
  id: string;
  propertyId: string;
  leaseId?: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate?: string;
  paidDate?: string;
  description?: string;
  category?: string;
  discrepancy?: number;
  notes?: string;
  metadata?: { source?: string } | null;
  property: { id: string; name: string; code: string };
  lease?: { id: string; leaseNumber: string; tenant?: { id: string; name: string } };
}

const SOURCE_LABEL: Record<string, string> = { quickbooks: 'QuickBooks' };

export function recordSourceLabel(record: { metadata?: { source?: string } | null }): string | null {
  const source = record.metadata?.source;
  return source ? SOURCE_LABEL[source] ?? null : null;
}

export function sourceLabel(source: string | null): string | null {
  return source ? SOURCE_LABEL[source] ?? null : null;
}

export type ActivityActionType = 'REVIEW' | 'COLLECT' | 'RECONCILE' | null;
export type EventKind = 'REFERENCE' | 'TASK';

export interface FinancialActivityEvent {
  id: string;
  date: string;
  type: string;
  category: string | null;
  description: string | null;
  amount: number;
  status: string;
  source: string | null;
  property: { id: string; name: string; code: string };
  tenant: { id: string; name: string } | null;
  kind: EventKind;
  isActionable: boolean;
  actionType: ActivityActionType;
  relatedLeaseId: string | null;
  relatedInvoiceId: string | null;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  revenueBasis: 'recorded' | 'contract';
  flaggedRecords: number;
  pendingRecords: number;
  reconciledRecords: number;
  totalEvents: number;
}

export interface RevenueTrendPoint {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

export interface ExpenseBreakdown {
  totalExpenses: number;
  categories: { category: string; total: number; count: number }[];
}

export interface ExpenseTrend {
  months: string[];
  categories: {
    category: string;
    totals: number[];
    latest: number;
    priorAvg: number;
    deltaPct: number | null;
    comparable: boolean;
    total: number;
  }[];
}

export type TenantRenewalRisk = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TenantProfitability {
  tenantId:      string;
  tenantName:    string;
  leaseCount:    number;
  monthlyRent:   number;
  allocatedCost: number;
  net:           number;
  marginPct:     number;
  nextLeaseEnd:  string | null;
  daysToExpiry:  number | null;
  renewalRisk:   TenantRenewalRisk | null;
  leasedSqft:    number | null;
}

export interface TenantProfitabilityReport {
  basis: 'sqft' | 'equal' | 'mixed';
  monthsAveraged: number;
  tenants: TenantProfitability[];
}

export interface NoiForecast {
  monthlyExpense:     number;
  projectedAnnualNet: number;
  points: { month: string; revenue: number; expenses: number; net: number }[];
}

export interface BudgetVarianceItem {
  id:          string;
  category:    string;
  propertyId:  string | null;
  budget:      number;
  actual:      number;
  variance:    number;
  variancePct: number | null;
  status:      'over' | 'under' | 'on_track';
}

export interface BudgetReport {
  month: string;
  items: BudgetVarianceItem[];
}

export interface RevenueRisk {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  monthlyRent: number;
  daysToExpiry: number;
  endDate: string;
  renewalRisk: string;
  renewalStage: string;
  impactScore: number;
  reasons: string[];
}

export interface RevenueAtRisk {
  totalAtRisk: number;
  leaseCount: number;
  expiringWithin30: number;
  renewalsNotStarted: number;
  highRiskCount: number;
  risks: RevenueRisk[];
}

export interface LateFeeForecastItem {
  leaseId: string;
  leaseNumber: string;
  propertyName: string;
  tenantName: string;
  overdueAmount: number;
  daysLate: number;
  graceDays: number;
  feeType: 'FLAT' | 'PERCENTAGE';
  baseFee: number;
  interest: number;
  fee: number;
  chargeable: boolean;
}

export interface TopOverdueLease {
  leaseId: string;
  tenantName: string;
  propertyName: string;
  daysLate: number;
  overdueAmount: number;
}

export interface LateFeeForecast {
  overdueBalance: number;
  overdueCount: number;
  chargeableCount: number;
  withinGraceCount: number;
  unconfiguredCount: number;
  firstUnconfiguredLeaseId: string | null;
  expectedLateFees: number;
  baseFees: number;
  interestAccrued: number;
  topOverdue: TopOverdueLease | null;
  items: LateFeeForecastItem[];
}

export interface AffectedLease {
  leaseId: string;
  leaseNumber: string;
  propertyName: string;
  tenantName: string;
  overdueAmount: number;
}

export interface LateFeeRecommendation {
  feeType: 'PERCENTAGE' | 'FLAT';
  percent: number | null;
  flat: number | null;
  graceDays: number;
  basis: 'portfolio' | 'standard';
}

export interface LateFeePolicySuggestion {
  affectedLeases: AffectedLease[];
  affectedCount: number;
  overdueTotal: number;
  recommended: LateFeeRecommendation;
}

export interface ApplyLateFeePolicyInput {
  feeType: 'PERCENTAGE' | 'FLAT';
  percent?: number | null;
  flat?: number | null;
  graceDays: number;
  leaseIds?: string[];
}

export type CollectionAction = 'REMIND' | 'APPLY_FEE' | 'ESCALATE' | 'RECORD';
export type RecoveryBand = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CollectionsContext {
  leaseId: string;
  tenantName: string;
  propertyName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  monthlyRent: number;
  outstandingBalance: number;
  daysOverdue: number;
  lateFeeConfigured: boolean;
  lastReminderAt: string | null;
  recommendation: { action: CollectionAction; reason: string };
  recovery: { band: RecoveryBand; reasons: string[] };
  history: { date: string; label: string }[];
  overdueRecordIds: string[];
}

export type Direction = 'up' | 'down' | 'flat';
export type Sentiment = 'good' | 'bad' | 'neutral';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';
export type HealthBand = 'HEALTHY' | 'WATCH' | 'AT_RISK';
export type ImpactUnit = 'PER_MONTH' | 'ONCE' | 'PERCENT';
export type RecommendationAction = 'RENEW_LEASE' | 'REVIEW_BUDGET' | 'COLLECT' | 'SET_LATE_FEE_POLICY';

export interface Confidence {
  level: ConfidenceLevel;
  basis: string;
}

export interface MetricDelta {
  key: 'revenue' | 'expenses' | 'netIncome';
  label: string;
  current: number;
  previous: number;
  deltaAbs: number;
  deltaPct: number | null;
  direction: Direction;
  sentiment: Sentiment;
  comparable: boolean;
  confidence: Confidence;
}

export interface Highlight {
  key: string;
  kind: 'REVENUE_AT_RISK' | 'OVER_BUDGET' | 'OVERDUE_RENT';
  count: number;
  amount: number | null;
  detail: string | null;
  tone: 'info' | 'warning' | 'critical';
  deepLink: string | null;
}

export interface HealthFactor {
  key: string;
  label: string;
  direction: Direction;
  sentiment: Sentiment;
  status: 'ok' | 'warn' | 'bad';
}

export interface HealthScore {
  score: number;
  band: HealthBand;
  factors: HealthFactor[];
  reasons: string[];
  confidence: Confidence;
}

export interface ChangeItem {
  key: string;
  label: string;
  amount: number | null;
  count: number | null;
  direction: Direction;
  sentiment: Sentiment;
}

export interface Recommendation {
  id: string;
  priority: number;
  title: string;
  description: string;
  impact: { value: number; unit: ImpactUnit } | null;
  severity: Severity;
  action: RecommendationAction;
  deepLink: string;
  confidence: Confidence;
}

export interface ExpirationLease {
  leaseId: string;
  tenantName: string;
  propertyName: string;
  monthlyRent: number;
  endDate: string;
}

export interface ExpirationMonth {
  month: string;
  expiringCount: number;
  revenueAtRisk: number;
  leases: ExpirationLease[];
}

export interface ForecastOutlook {
  horizonMonths: number;
  totalRevenueAtRisk: number;
  timeline: ExpirationMonth[];
  confidence: Confidence;
  confidenceScore: number;
}

export interface FinancialIntelligence {
  generatedAt: string;
  metrics: MetricDelta[];
  highlights: Highlight[];
  health: HealthScore;
  sinceLastVisit: ChangeItem[];
  recommendations: Recommendation[];
}

export const financeService = {
  getRecords: (query: Record<string, unknown> = {}): Promise<PaginatedResult<FinancialActivityEvent>> =>
    api.get('/finance', { params: query }).then(extractPaginated<FinancialActivityEvent>),

  getPulse: (): Promise<FinancialActivityEvent[]> =>
    api.get('/finance/pulse').then(extractData<FinancialActivityEvent[]>),

  getRecord: (id: string): Promise<FinancialRecord> =>
    api.get(`/finance/${id}`).then(extractData<FinancialRecord>),

  updateRecord: (id: string, data: { status?: string; discrepancy?: number }): Promise<FinancialRecord> =>
    api.patch(`/finance/${id}`, data).then(extractData<FinancialRecord>),

  getSummary: (propertyId?: string): Promise<FinancialSummary> =>
    api.get('/finance/summary', { params: { propertyId } }).then(extractData<FinancialSummary>),

  getTrend: (propertyId?: string, months = 12): Promise<RevenueTrendPoint[]> =>
    api.get('/finance/trend', { params: { propertyId, months } }).then(extractData<RevenueTrendPoint[]>),

  getAtRisk: (): Promise<RevenueAtRisk> =>
    api.get('/finance/at-risk').then(extractData<RevenueAtRisk>),

  getIntelligence: (): Promise<FinancialIntelligence> =>
    api.get('/finance/intelligence').then(extractData<FinancialIntelligence>),

  getForecastOutlook: (): Promise<ForecastOutlook> =>
    api.get('/finance/forecast-outlook').then(extractData<ForecastOutlook>),

  getExpenseBreakdown: (params: { propertyId?: string; from?: string; to?: string } = {}): Promise<ExpenseBreakdown> =>
    api.get('/finance/expense-breakdown', { params }).then(extractData<ExpenseBreakdown>),

  getExpenseTrend: (params: { propertyId?: string; months?: number } = {}): Promise<ExpenseTrend> =>
    api.get('/finance/expense-trend', { params }).then(extractData<ExpenseTrend>),

  getTenantProfitability: (): Promise<TenantProfitabilityReport> =>
    api.get('/finance/tenant-profitability').then(extractData<TenantProfitabilityReport>),

  getNoiForecast: (params: { months?: number } = {}): Promise<NoiForecast> =>
    api.get('/finance/forecast', { params }).then(extractData<NoiForecast>),

  getLateFeeForecast: (): Promise<LateFeeForecast> =>
    api.get('/finance/late-fee-forecast').then(extractData<LateFeeForecast>),

  getLateFeePolicySuggestion: (): Promise<LateFeePolicySuggestion> =>
    api.get('/finance/late-fee-policy/suggestion').then(extractData<LateFeePolicySuggestion>),

  applyLateFeePolicy: (input: ApplyLateFeePolicyInput): Promise<{ applied: number }> =>
    api.post('/finance/late-fee-policy/apply', input).then(extractData<{ applied: number }>),

  getCollections: (leaseId: string): Promise<CollectionsContext> =>
    api.get(`/finance/collections/${leaseId}`).then(extractData<CollectionsContext>),

  collectionsRecordPayment: (leaseId: string): Promise<{ recorded: number }> =>
    api.post(`/finance/collections/${leaseId}/record-payment`).then(extractData<{ recorded: number }>),

  collectionsRemind: (leaseId: string): Promise<{ sent: boolean }> =>
    api.post(`/finance/collections/${leaseId}/remind`).then(extractData<{ sent: boolean }>),

  collectionsApplyLateFee: (leaseId: string): Promise<{ applied: number }> =>
    api.post(`/finance/collections/${leaseId}/apply-late-fee`).then(extractData<{ applied: number }>),

  getBudgets: (): Promise<BudgetReport> =>
    api.get('/finance/budgets').then(extractData<BudgetReport>),

  upsertBudget: (input: { category: string; propertyId?: string | null; monthlyAmount: number }): Promise<unknown> =>
    api.put('/finance/budgets', input).then(extractData<unknown>),

  deleteBudget: (id: string): Promise<unknown> =>
    api.delete(`/finance/budgets/${id}`).then(extractData<unknown>),
};
