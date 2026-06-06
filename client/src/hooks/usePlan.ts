import { useAuthStore, type Plan } from '@/state/auth.store';

export const PLAN_ORDER: Record<Plan, number> = {
  ESSENTIALS:   0,
  PROFESSIONAL: 1,
  EXECUTIVE:    2,
};

export const PLAN_LIMITS: Record<Plan, { properties: number; leases: number }> = {
  ESSENTIALS:   { properties: 25,       leases: 500   },
  PROFESSIONAL: { properties: 150,      leases: 5_000 },
  EXECUTIVE:    { properties: Infinity, leases: Infinity },
};

export const PLAN_LABELS: Record<Plan, string> = {
  ESSENTIALS:   'Essentials',
  PROFESSIONAL: 'Professional',
  EXECUTIVE:    'Executive',
};

export const PLAN_PRICES: Record<Plan, number> = {
  ESSENTIALS:   149,
  PROFESSIONAL: 499,
  EXECUTIVE:    1499,
};

// Which plans each feature requires
const FEATURE_MIN_PLAN: Record<string, Plan> = {
  work_queue:            'PROFESSIONAL',
  tasks:                 'PROFESSIONAL',
  crm:                   'PROFESSIONAL',
  documents:             'PROFESSIONAL',
  team:                  'PROFESSIONAL',
  automation:            'PROFESSIONAL',
  performance:           'PROFESSIONAL',
  executive_brief:       'PROFESSIONAL',
  health_score:          'PROFESSIONAL',
  impact_analysis:       'EXECUTIVE',
  contract_intelligence: 'EXECUTIVE',
};

export function usePlan() {
  const user = useAuthStore((s) => s.user);
  const plan: Plan = user?.plan ?? 'ESSENTIALS';

  function canAccess(feature: string): boolean {
    const required = FEATURE_MIN_PLAN[feature];
    if (!required) return true; // Essentials feature, always accessible
    return PLAN_ORDER[plan] >= PLAN_ORDER[required];
  }

  function requiredPlan(feature: string): Plan | null {
    const required = FEATURE_MIN_PLAN[feature];
    if (!required) return null;
    if (PLAN_ORDER[plan] >= PLAN_ORDER[required]) return null;
    return required;
  }

  return {
    plan,
    label:   PLAN_LABELS[plan],
    price:   PLAN_PRICES[plan],
    limits:  PLAN_LIMITS[plan],
    canAccess,
    requiredPlan,
    isEssentials:   plan === 'ESSENTIALS',
    isProfessional: plan === 'PROFESSIONAL',
    isExecutive:    plan === 'EXECUTIVE',
  };
}
