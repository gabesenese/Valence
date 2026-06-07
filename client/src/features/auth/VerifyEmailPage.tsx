import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/state/auth.store';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const updateUser = useAuthStore((s) => s.updateUser);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    authService.verifyEmail(token)
      .then(() => {
        updateUser({ emailVerifiedAt: new Date().toISOString() });
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [token, updateUser]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up px-4">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-glow-brand">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Valence</h1>
        </div>

        <div className="rounded-2xl border border-surface-400/60 bg-surface-100/80 p-8 shadow-card backdrop-blur-sm text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-brand-400" />
              <p className="text-sm text-slate-400">Verifying your email…</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
              <h2 className="text-base font-semibold text-white">Email verified</h2>
              <p className="mt-2 text-xs text-slate-400">Your email address has been confirmed.</p>
              <Link to="/" className="mt-6 inline-block text-xs text-brand-400 hover:text-brand-300 transition-colors">
                Go to dashboard →
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="mx-auto mb-3 h-10 w-10 text-danger" />
              <h2 className="text-base font-semibold text-white">Verification failed</h2>
              <p className="mt-2 text-xs text-slate-400">This link is invalid or has expired.</p>
              <Link to="/auth/login" className="mt-6 inline-block text-xs text-brand-400 hover:text-brand-300 transition-colors">
                Sign in to resend →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
