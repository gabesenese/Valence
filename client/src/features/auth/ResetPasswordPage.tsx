import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Activity, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/auth/login'), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <div className="text-center">
          <p className="text-sm text-danger">Invalid reset link.</p>
          <Link to="/auth/forgot-password" className="mt-2 block text-xs text-brand-400 hover:text-brand-300">Request a new one →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up px-4">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-glow-brand">
            <Activity className="h-6 w-6 text-fg" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-fg tracking-tight">Valence</h1>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-400/60 bg-surface-100/80 p-8 shadow-card backdrop-blur-sm">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
              <h2 className="text-base font-semibold text-fg">Password reset</h2>
              <p className="mt-2 text-xs text-slate-400">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-base font-semibold text-fg">Set new password</h2>
                <p className="mt-0.5 text-xs text-slate-500">Must be at least 8 characters.</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 pr-10 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">Confirm password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                    <p className="text-xs text-danger">{error}</p>
                  </div>
                )}

                <Button type="submit" loading={loading} className="mt-1 w-full">
                  Reset password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
