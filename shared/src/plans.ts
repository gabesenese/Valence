export type PlanTier = 'FREE' | 'ESSENTIALS' | 'PROFESSIONAL' | 'EXECUTIVE';

export interface PlanUsageLimits {
  properties:  number;
  leases:      number;
  aiRuns:      number;
  contracts:   number;
  simulations: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanUsageLimits> = {
  FREE:         { properties: 3,        leases: 25,       aiRuns: 0,        contracts: 0,        simulations: 0        },
  ESSENTIALS:   { properties: 25,       leases: 500,      aiRuns: 500,      contracts: 100,      simulations: 100      },
  PROFESSIONAL: { properties: 150,      leases: 5_000,    aiRuns: 5_000,    contracts: 1_000,    simulations: 500      },
  EXECUTIVE:    { properties: Infinity, leases: Infinity, aiRuns: Infinity, contracts: Infinity, simulations: Infinity },
};

export function formatAllowance(limit: number): string {
  return limit === Infinity ? 'Unlimited' : `${limit.toLocaleString('en-US')} / month`;
}
