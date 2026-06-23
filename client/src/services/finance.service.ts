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
  property: { id: string; name: string; code: string };
  lease?: { id: string; leaseNumber: string };
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  flaggedRecords: number;
  pendingRecords: number;
}

export interface RevenueTrendPoint {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
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

export const financeService = {
  getRecords: (query: Record<string, unknown> = {}): Promise<PaginatedResult<FinancialRecord>> =>
    api.get('/finance', { params: query }).then(extractPaginated<FinancialRecord>),

  getRecord: (id: string): Promise<FinancialRecord> =>
    api.get(`/finance/${id}`).then(extractData<FinancialRecord>),

  getSummary: (propertyId?: string): Promise<FinancialSummary> =>
    api.get('/finance/summary', { params: { propertyId } }).then(extractData<FinancialSummary>),

  getTrend: (propertyId?: string, months = 12): Promise<RevenueTrendPoint[]> =>
    api.get('/finance/trend', { params: { propertyId, months } }).then(extractData<RevenueTrendPoint[]>),

  getAtRisk: (): Promise<RevenueAtRisk> =>
    api.get('/finance/at-risk').then(extractData<RevenueAtRisk>),
};
