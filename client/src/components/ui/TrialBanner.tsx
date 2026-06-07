import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useAuthStore } from '@/state/auth.store';

export function TrialBanner() {
  const navigate = useNavigate();
  const { trialActive, trialExpired, daysLeft } = usePlan();
  const userRole = useAuthStore((s) => s.user?.role);
  const canUpgrade = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  if (!trialActive && !trialExpired) return null;

  if (trialExpired) {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-danger/20 bg-danger/10 px-6 py-2.5">
        <div className="flex items-center gap-2 text-xs text-danger">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Your trial has ended.</span>
          <span className="text-danger/70">Upgrade to keep access to your features.</span>
        </div>
        {canUpgrade && (
          <button
            onClick={() => navigate('/pricing')}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-danger/20 hover:bg-danger/30 border border-danger/30 px-3 py-1 text-xs font-semibold text-danger transition-colors"
          >
            Upgrade now
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  const urgent = daysLeft <= 3;

  return (
    <div
      className={`flex items-center justify-between gap-4 border-b px-6 py-2.5 ${
        urgent
          ? 'border-orange-500/20 bg-orange-500/10'
          : 'border-brand-500/20 bg-brand-500/10'
      }`}
    >
      <div className={`flex items-center gap-2 text-xs ${urgent ? 'text-orange-300' : 'text-brand-300'}`}>
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">
          {daysLeft === 0 ? 'Trial ends today.' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial.`}
        </span>
        <span className={urgent ? 'text-orange-400/70' : 'text-brand-400/70'}>
          You have full Professional access until it ends.
        </span>
      </div>
      {canUpgrade && (
        <button
          onClick={() => navigate('/pricing')}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
            urgent
              ? 'border-orange-500/30 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300'
              : 'border-brand-500/30 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300'
          }`}
        >
          Upgrade
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
