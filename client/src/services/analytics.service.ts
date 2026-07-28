import { api, extractData } from './api';

export interface PortfolioInsight {
  id: string;
  category: 'LEASE' | 'FINANCIAL' | 'OPERATIONAL' | 'RISK';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  context: string;
  href: string;
  value?: string;
}

export const analyticsService = {
  getSummary: () =>
    api.get('/analytics/summary').then(extractData<ExecutiveSummary>),

  getInsights: () =>
    api.get('/analytics/insights').then(extractData<PortfolioInsight[]>),

  getBenchmarks: () =>
    api.get('/analytics/benchmarks').then(extractData<BenchmarkReport>),
};

export interface ExecutiveSummary {
  properties: { total: number };
  leases: { active: number; expiringIn30: number; expiringIn90: number };
  revenue: { current: number; previous: number; growthPct: number };
  alerts: { open: number; critical: number };
  occupancy: { rate: number; occupied: number; total: number };
}

export interface PropertyScorecard {
  id:              string;
  name:            string;
  code:            string;
  totalUnits:      number;
  activeLeases:    number;
  occupancyRate:   number;
  monthlyRevenue:  number;
  monthlyExpenses: number;
  noi:             number;
  revenuePerUnit:  number;
  noiPerUnit:      number;
  totalSqft:       number;
  costPerSqft:     number;
  noiPerSqft:      number;
  revenueDeltaPct: number | null;
  openAlerts:      number;
  criticalAlerts:  number;
  expiringSoon:    number;
  highRiskLeases:  number;
  riskScore:       number;
  compositeScore:  number;
  percentile:      number;
  ranks: {
    byRevenue:   number;
    byGrowth:    number | null;
    byNOI:       number;
    byRisk:      number;
    byOccupancy: number;
  };
  isOutlier:      boolean;
  outlierReasons: string[];
}

export interface BenchmarkReport {
  generatedAt:       string;
  propertyCount:     number;
  portfolioAverages: {
    occupancyRate:   number;
    monthlyRevenue:  number;
    noi:             number;
    revenuePerUnit:  number;
    riskScore:       number;
  };
  highlights: {
    bestRevenue:     PropertyScorecard | null;
    fastestGrowing:  PropertyScorecard | null;
    highestNOI:      PropertyScorecard | null;
    lowestRisk:      PropertyScorecard | null;
    worstPerforming: PropertyScorecard | null;
    highestRisk:     PropertyScorecard | null;
  };
  outliers:   PropertyScorecard[];
  properties: PropertyScorecard[];
}
