import type { AdminStats, AnalyticsData, RevenueData, CustomerHealth, AdoptionData } from '@/services/admin.service';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export const DEV_ADMIN_FIXTURES_ACTIVE = import.meta.env.DEV;

export const FAKE_STATS: AdminStats = {
  totalUsers: 8,
  byPlan: { FREE: 3, ESSENTIALS: 2, PROFESSIONAL: 2, EXECUTIVE: 1 },
  signupsToday: 0,
  signups7d: 1,
  signups30d: 4,
  activeTrials: 2,
  emailVerified: 7,
  mfaEnabled: 1,
};

export const FAKE_REVENUE: RevenueData = {
  mrr: 2796,
  arr: 33552,
  arpu: 559,
  payingAccounts: 5,
  activeTrials: 2,
  trialConvRate: 28,
  costEstimated: true,
  planMix: [
    { plan: 'EXECUTIVE', count: 1, price: 1500, mrr: 1500 },
    { plan: 'PROFESSIONAL', count: 2, price: 499, mrr: 998 },
    { plan: 'ESSENTIALS', count: 2, price: 149, mrr: 298 },
  ],
};

function last30Days(hits: Record<number, number>) {
  const out: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), count: hits[29 - i] ?? 0 });
  }
  return out;
}

export const FAKE_ANALYTICS: AnalyticsData = {
  mrr: 2796,
  arr: 33552,
  planDist: { FREE: 3, ESSENTIALS: 2, PROFESSIONAL: 2, EXECUTIVE: 1 },
  trialConvRate: 28,
  signupTrend: last30Days({ 3: 1, 11: 1, 19: 1, 27: 1 }),
  churn: { inactive14: 1, inactive30: 0, inactive60: 0 },
  cohorts: [
    { week: 'W1', users: 1 }, { week: 'W2', users: 0 }, { week: 'W3', users: 1 }, { week: 'W4', users: 0 },
    { week: 'W5', users: 1 }, { week: 'W6', users: 0 }, { week: 'W7', users: 0 }, { week: 'W8', users: 1 },
    { week: 'W9', users: 0 }, { week: 'W10', users: 0 }, { week: 'W11', users: 1 }, { week: 'W12', users: 0 },
  ],
  adoption: { withProperties: 6, withLeases: 5, withAlerts: 3, withTasks: 4, withAI: 2 },
  slowAccounts: [
    { id: 'dev-1', email: 'ops@birchwoodrealty.example', firstName: 'Birchwood', lastName: 'Realty', plan: 'EXECUTIVE', _count: { ownedProperties: 14, ownedLeases: 22, ownedTenants: 19 } },
    { id: 'dev-2', email: 'admin@lakeviewpg.example', firstName: 'Lakeview', lastName: 'Property Group', plan: 'PROFESSIONAL', _count: { ownedProperties: 6, ownedLeases: 9, ownedTenants: 8 } },
    { id: 'dev-3', email: 'hello@summitrentals.example', firstName: 'Summit', lastName: 'Rentals', plan: 'PROFESSIONAL', _count: { ownedProperties: 4, ownedLeases: 6, ownedTenants: 5 } },
  ],
};

export const FAKE_HEALTH: CustomerHealth = {
  summary: { total: 8, healthy: 4, watch: 2, atRisk: 2 },
  accounts: [
    { id: 'dev-5', email: 'contact@maplestreetmgmt.example', name: 'Maple Street Management', plan: 'ESSENTIALS', score: 24, band: 'at_risk',
      signals: { active: false, hasProperties: false, hasLeases: false, hasRevenue: false },
      risks: ['No login in 21 days', 'No properties imported'], lastLoginAt: daysAgo(21), trialEndsAt: null },
    { id: 'dev-7', email: 'team@pinecrestestates.example', name: 'Pinecrest Estates', plan: 'FREE', score: 19, band: 'at_risk',
      signals: { active: false, hasProperties: false, hasLeases: false, hasRevenue: false },
      risks: ['No login in 12 days', 'Trial ends in 2 days'], lastLoginAt: daysAgo(12), trialEndsAt: daysFromNow(2) },
    { id: 'dev-3', email: 'hello@summitrentals.example', name: 'Summit Rentals', plan: 'PROFESSIONAL', score: 58, band: 'watch',
      signals: { active: true, hasProperties: true, hasLeases: true, hasRevenue: false },
      risks: ['No revenue synced yet'], lastLoginAt: daysAgo(3), trialEndsAt: null },
    { id: 'dev-6', email: 'ops@harborviewproperties.example', name: 'Harbor View Properties', plan: 'FREE', score: 55, band: 'watch',
      signals: { active: true, hasProperties: true, hasLeases: false, hasRevenue: false },
      risks: ['Trial ends in 4 days', 'No leases created'], lastLoginAt: daysAgo(1), trialEndsAt: daysFromNow(4) },
    { id: 'dev-4', email: 'info@cedargroveholdings.example', name: 'Cedar Grove Holdings', plan: 'ESSENTIALS', score: 81, band: 'healthy',
      signals: { active: true, hasProperties: true, hasLeases: true, hasRevenue: true }, risks: [], lastLoginAt: daysAgo(2), trialEndsAt: null },
    { id: 'dev-8', email: 'team@oakridgerentals.example', name: 'Oakridge Rentals', plan: 'FREE', score: 88, band: 'healthy',
      signals: { active: true, hasProperties: true, hasLeases: true, hasRevenue: false }, risks: [], lastLoginAt: daysAgo(0), trialEndsAt: daysFromNow(9) },
    { id: 'dev-2', email: 'admin@lakeviewpg.example', name: 'Lakeview Property Group', plan: 'PROFESSIONAL', score: 85, band: 'healthy',
      signals: { active: true, hasProperties: true, hasLeases: true, hasRevenue: true }, risks: [], lastLoginAt: daysAgo(1), trialEndsAt: null },
    { id: 'dev-1', email: 'ops@birchwoodrealty.example', name: 'Birchwood Realty', plan: 'EXECUTIVE', score: 92, band: 'healthy',
      signals: { active: true, hasProperties: true, hasLeases: true, hasRevenue: true }, risks: [], lastLoginAt: daysAgo(0), trialEndsAt: null },
  ],
};

export const FAKE_ADOPTION: AdoptionData = {
  summary: { total: 8, import: 75, finance: 63, workQueue: 63, automation: 25, ai: 38 },
  accounts: [
    { id: 'dev-1', email: 'ops@birchwoodrealty.example', name: 'Birchwood Realty', plan: 'EXECUTIVE', import: true, finance: 14, workQueue: 9, automation: 5, ai: 12 },
    { id: 'dev-2', email: 'admin@lakeviewpg.example', name: 'Lakeview Property Group', plan: 'PROFESSIONAL', import: true, finance: 6, workQueue: 4, automation: 2, ai: 3 },
    { id: 'dev-3', email: 'hello@summitrentals.example', name: 'Summit Rentals', plan: 'PROFESSIONAL', import: true, finance: 3, workQueue: 2, automation: 0, ai: 1 },
    { id: 'dev-4', email: 'info@cedargroveholdings.example', name: 'Cedar Grove Holdings', plan: 'ESSENTIALS', import: true, finance: 2, workQueue: 1, automation: 0, ai: 0 },
    { id: 'dev-5', email: 'contact@maplestreetmgmt.example', name: 'Maple Street Management', plan: 'ESSENTIALS', import: false, finance: 0, workQueue: 0, automation: 0, ai: 0 },
    { id: 'dev-6', email: 'ops@harborviewproperties.example', name: 'Harbor View Properties', plan: 'FREE', import: true, finance: 1, workQueue: 1, automation: 0, ai: 0 },
    { id: 'dev-7', email: 'team@pinecrestestates.example', name: 'Pinecrest Estates', plan: 'FREE', import: false, finance: 0, workQueue: 0, automation: 0, ai: 0 },
    { id: 'dev-8', email: 'team@oakridgerentals.example', name: 'Oakridge Rentals', plan: 'FREE', import: true, finance: 0, workQueue: 0, automation: 0, ai: 0 },
  ],
};

export const FAKE_FUNNEL: { step: string; count: number; convRate: number | null }[] = [
  { step: 'visitor', count: 140, convRate: null },
  { step: 'signup', count: 22, convRate: 16 },
  { step: 'setup_complete', count: 17, convRate: 77 },
  { step: 'data_imported', count: 15, convRate: 88 },
  { step: 'first_insight', count: 13, convRate: 87 },
  { step: 'team_invited', count: 5, convRate: 38 },
  { step: 'upgrade_clicked', count: 3, convRate: 60 },
  { step: 'upgraded', count: 2, convRate: 67 },
];
