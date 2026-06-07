import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Activity, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA step
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totp, setTotp] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/queue';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authService.login(email, password);
      if ('mfaRequired' in result) {
        setMfaToken(result.mfaToken);
        return;
      }
      setAuth(result.user, result.tokens.accessToken, result.tokens.refreshToken);
      localStorage.setItem('valence-remember-me', rememberMe ? '1' : '0');
      if (!rememberMe) sessionStorage.setItem('valence-session-active', '1');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError('');
    setLoading(true);
    try {
      const result = await authService.verifyMfa(mfaToken, totp);
      setAuth(result.user, result.tokens.accessToken, result.tokens.refreshToken);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid code');
    } finally {
      setLoading(false);
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

        {/* MFA card */}
        {mfaToken && (
          <div className="rounded-2xl border border-surface-400/60 bg-surface-100/80 p-8 shadow-card backdrop-blur-sm">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-white">Two-factor authentication</h2>
              <p className="mt-0.5 text-xs text-slate-500">Enter the 6-digit code from your authenticator app.</p>
            </div>
            <form onSubmit={handleMfaSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">Authenticator code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoFocus
                  className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-center text-lg tracking-widest text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                  <p className="text-xs text-danger">{error}</p>
                </div>
              )}
              <Button type="submit" loading={loading} className="mt-1 w-full">Verify</Button>
            </form>
            <button onClick={() => { setMfaToken(null); setError(''); }} className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ← Back
            </button>
          </div>
        )}

        {/* Card */}
        {!mfaToken && (
        <div className="rounded-2xl border border-surface-400/60 bg-surface-100/80 p-8 shadow-card backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Sign in</h2>
            <p className="mt-0.5 text-xs text-slate-500">Access your portfolio intelligence</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="h-4 w-4 rounded border border-surface-400 bg-surface-200 transition-colors peer-checked:border-brand-500 peer-checked:bg-brand-600 flex items-center justify-center">
                  {rememberMe && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-slate-400">Remember me</span>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="mt-1 w-full">
              Sign in
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>
                No account?{' '}
                <Link to="/auth/register" className="text-brand-400 hover:text-brand-300 transition-colors">
                  Create one
                </Link>
              </span>
              <Link to="/auth/forgot-password" className="text-slate-500 hover:text-slate-300 transition-colors">
                Forgot password?
              </Link>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-surface-400/40 bg-surface-200/50 p-3">
            <p className="text-xs font-medium text-slate-400 mb-1.5">Demo credentials</p>
            <p className="text-xs text-slate-300 font-mono">admin@valence.dev</p>
            <p className="text-xs text-slate-300 font-mono">Admin1234!</p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
