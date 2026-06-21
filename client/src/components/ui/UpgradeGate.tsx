import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { usePlan, PLAN_LABELS, PLAN_PRICES } from '@/hooks/usePlan';
import type { Plan } from '@/state/auth.store';

interface UpgradeGateProps {
  feature: string;
  children: React.ReactNode;
  overlay?: boolean;
}

function UpgradeBanner({ required }: { required: Plan }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-surface-400/40 bg-surface-100 py-16 text-center px-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-300/60 ring-1 ring-surface-400/40">
        <Lock className="h-5 w-5 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-fg">
          {PLAN_LABELS[required]} plan required
        </p>
        <p className="mt-1 text-xs text-slate-500 max-w-xs">
          This feature is available on the {PLAN_LABELS[required]} plan
          {' '}(${PLAN_PRICES[required].toLocaleString()}/mo) and above.
        </p>
      </div>
      <button
        onClick={() => navigate('/pricing')}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
      >
        View plans
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function UpgradeGate({ feature, children, overlay }: UpgradeGateProps) {
  const { canAccess, requiredPlan } = usePlan();

  if (canAccess(feature)) return <>{children}</>;

  const required = requiredPlan(feature)!;

  if (overlay) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-30 blur-[2px]">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-surface-400/60 bg-surface-100 px-6 py-4 text-center shadow-xl">
            <Lock className="mx-auto mb-2 h-4 w-4 text-slate-400" />
            <p className="text-xs font-semibold text-fg">{PLAN_LABELS[required]} required</p>
          </div>
        </div>
      </div>
    );
  }

  return <UpgradeBanner required={required} />;
}
