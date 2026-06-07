import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/state/auth.store';
import { PLAN_LABELS } from '@/hooks/usePlan';

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [loading, setLoading] = useState(true);
  const [planLabel, setPlanLabel] = useState('');

  useEffect(() => {
    authService.getMe()
      .then((user) => {
        // Re-hydrate the auth store with the updated user + existing tokens
        if (accessToken && refreshToken) {
          setAuth(user, accessToken, refreshToken);
        }
        setPlanLabel(PLAN_LABELS[user.plan]);
      })
      .catch(() => { /* plan update may not be instant; redirect anyway */ })
      .finally(() => {
        setLoading(false);
        const t = setTimeout(() => navigate('/'), 4000);
        return () => clearTimeout(t);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-0 text-center px-6">
      {loading ? (
        <Loader2 className="h-10 w-10 animate-spin text-brand-400" />
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 border border-success/20">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">You're all set</h1>
            {planLabel && (
              <p className="mt-2 text-sm text-slate-400">
                Your account has been upgraded to <span className="font-semibold text-white">{planLabel}</span>.
              </p>
            )}
            <p className="mt-1 text-xs text-slate-600">Redirecting to dashboard…</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-xl bg-brand-600 hover:bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Go to Dashboard
          </button>
        </>
      )}
    </div>
  );
}
