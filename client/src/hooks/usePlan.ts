import { useAuthStore, type Plan } from '@/state/auth.store';

export const PLAN_ORDER: Record<Plan, number> = {
  FREE:         0,
  ESSENTIALS:   1,
  PROFESSIONAL: 2,
  EXECUTIVE:    3,
};

export const PLAN_LIMITS: Record<Plan, { properties: number; leases: number }> = {
  FREE:         { properties: 3,        leases: 25    },
  ESSENTIALS:   { properties: 25,       leases: 500   },
  PROFESSIONAL: { properties: 150,      leases: 5_000 },
  EXECUTIVE:    { properties: Infinity, leases: Infinity },
};

export const PLAN_LABELS: Record<Plan, string> = {
  FREE:         'Free',
  ESSENTIALS:   'Essentials',
  PROFESSIONAL: 'Professional',
  EXECUTIVE:    'Executive',
};

export const PLAN_PRICES: Record<Plan, number> = {
  FREE:         0,
  ESSENTIALS:   149,
  PROFESSIONAL: 499,
  EXECUTIVE:    1499,
};

const FEATURE_MIN_PLAN: Record<string, Plan> = {
  finance:               'ESSENTIALS',
  analytics:             'ESSENTIALS',
  alerts:                'ESSENTIALS',
  work_queue:            'PROFESSIONAL',
  integrations:          'PROFESSIONAL',
  tasks:                 'PROFESSIONAL',
  crm:                   'PROFESSIONAL',
  documents:             'PROFESSIONAL',
  team:                  'PROFESSIONAL',
  automation:            'PROFESSIONAL',
  performance:           'PROFESSIONAL',
  executive_brief:       'EXECUTIVE',
  health_score:          'PROFESSIONAL',
  impact_analysis:       'ESSENTIALS',
  contract_intelligence: 'ESSENTIALS',
};

export function usePlan() {
  const user = useAuthStore((s) => s.user);
  const plan: Plan = user?.plan ?? 'FREE';
  const trialEndsAt = user?.trialEndsAt ?? null;

  const trialActive = trialEndsAt != null && new Date(trialEndsAt) > new Date();
  const trialExpired = trialEndsAt != null && !trialActive && (plan === 'FREE' || plan === 'ESSENTIALS');
  const daysLeft = trialActive
    ? Math.max(0, Math.ceil((new Date(trialEndsAt!).getTime() - Date.now()) / 86_400_000))
    : 0;

  const effectivePlan: Plan =
    trialActive && PLAN_ORDER[plan] < PLAN_ORDER['PROFESSIONAL'] ? 'PROFESSIONAL' : plan;

  const addons = user?.addons ?? [];
  function hasAddon(key: string): boolean {
    return addons.includes(key);
  }

  function canAccess(feature: string): boolean {
    const required = FEATURE_MIN_PLAN[feature];
    if (!required) return true;
    return PLAN_ORDER[effectivePlan] >= PLAN_ORDER[required];
  }

  function requiredPlan(feature: string): Plan | null {
    const required = FEATURE_MIN_PLAN[feature];
    if (!required) return null;
    if (PLAN_ORDER[effectivePlan] >= PLAN_ORDER[required]) return null;
    return required;
  }

  return {
    plan,
    effectivePlan,
    label:   PLAN_LABELS[plan],
    price:   PLAN_PRICES[plan],
    limits:  PLAN_LIMITS[effectivePlan],
    addons,
    hasAddon,
    canAccess,
    requiredPlan,
    isFree:         plan === 'FREE',
    isEssentials:   plan === 'ESSENTIALS',
    isProfessional: plan === 'PROFESSIONAL',
    isExecutive:    plan === 'EXECUTIVE',
    trialActive,
    trialExpired,
    trialEndsAt,
    daysLeft,
  };
}
