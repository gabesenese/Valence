import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Activity, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { usersService, type InviteInfo } from '@/services/users.service';
import { useAuthStore } from '@/state/auth.store';
import { Button } from '@/components/ui/Button';
import type { Plan } from '@/state/auth.store';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  ANALYST: 'Analyst',
  VIEWER: 'Viewer',
};

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setLoadError('Invalid invite link.'); setLoading(false); return; }
    usersService.validateInvite(token)
      .then((info) => { setInviteInfo(info); setLoading(false); })
      .catch((err: Error) => { setLoadError(err.message || 'This invite link is invalid or has expired.'); setLoading(false); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSubmitting(true);
    try {
      const result = await usersService.acceptInvite(token!, { firstName, lastName, password });
      localStorage.setItem('valence-remember-me', '1');
      setAuth(
        { ...result.user, plan: result.user.plan as Plan, emailVerifiedAt: null, mfaEnabled: false },
        result.tokens.accessToken,
        result.tokens.refreshToken,
      );
      navigate('/');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-600/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-brand-800/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-glow-brand">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Valence</h1>
            <p className="mt-0.5 text-xs text-slate-500">Operational Intelligence Platform</p>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-400/60 bg-surface-100/80 p-8 shadow-card backdrop-blur-sm">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
              <p className="text-xs text-slate-500">Validating invite…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertCircle className="h-8 w-8 text-danger" />
              <p className="text-sm font-medium text-slate-300">Invite invalid</p>
              <p className="text-xs text-slate-500">{loadError}</p>
              <Link to="/auth/login" className="mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                Go to sign in →
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <h2 className="text-base font-semibold text-white">You've been invited</h2>
                </div>
                <p className="text-xs text-slate-500">
                  {inviteInfo!.invitedBy.firstName} {inviteInfo!.invitedBy.lastName} invited{' '}
                  <span className="text-slate-300">{inviteInfo!.email}</span> as a{' '}
                  <span className="text-brand-400">{ROLE_LABELS[inviteInfo!.role] ?? inviteInfo!.role}</span>.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Email — read-only */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">Email</label>
                  <div className="h-9 w-full rounded-lg border border-surface-400/40 bg-surface-300/40 px-3 flex items-center text-sm text-slate-500">
                    {inviteInfo!.email}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      required
                      autoFocus
                      className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      required
                      className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 pr-10 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && password.length < 8 && (
                    <p className="text-[11px] text-slate-600">
                      {8 - password.length} more character{8 - password.length !== 1 ? 's' : ''} needed
                    </p>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                    <p className="text-xs text-danger">{error}</p>
                  </div>
                )}

                <Button type="submit" loading={submitting} className="mt-1 w-full">
                  Create account
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-slate-600">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-brand-400 hover:text-brand-300 transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
