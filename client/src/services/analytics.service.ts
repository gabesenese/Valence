import { api, extractData } from './api';

export const analyticsService = {
  getSummary: () =>
    api.get('/analytics/summary').then(extractData<ExecutiveSummary>),

  getLeaseDistribution: () =>
    api.get('/analytics/lease-distribution').then(extractData<LeaseDistribution>),

  getPropertyPerformance: () =>
    api.get('/analytics/property-performance').then(extractData<PropertyPerformance[]>),

  getRevenueTrend: (months = 12) =>
    api.get('/analytics/revenue-trend', { params: { months } }).then(extractData<RevenueTrendPoint[]>),
};

export interface ExecutiveSummary {
  properties: { total: number };
  leases: { active: number; expiringIn30: number; expiringIn90: number };
  revenue: { current: number; previous: number; growthPct: number };
  alerts: { open: number; critical: number };
  occupancy: { rate: number; occupied: number; total: number };
}

export interface RevenueTrendPoint {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

export interface LeaseDistribution {
  byStatus: Array<{ status: string; _count: number }>;
  byRisk: Array<{ renewalRisk: string; _count: number }>;
  byType: Array<{ type: string; _count: number }>;
}

export interface PropertyPerformance {
  id: string;
  name: string;
  code: string;
  totalUnits: number;
  activeLeases: number;
  occupancyRate: number;
  monthlyRevenue: number;
}
