import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authService.login(email, password);
      setAuth(result.user, result.tokens.accessToken, result.tokens.refreshToken);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Authentication failed');
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

        {/* Card */}
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
                  className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 pr-10 text-sm text-slate-100 placeholder:text-slate-600 transition-all focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
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

          <div className="mt-4 text-center">
            <p className="text-xs text-slate-600">
              No account?{' '}
              <Link to="/auth/register" className="text-brand-400 hover:text-brand-300 transition-colors">
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-5 rounded-lg border border-surface-400/40 bg-surface-200/50 p-3">
            <p className="text-2xs font-medium text-slate-500 mb-1.5">Demo credentials</p>
            <p className="text-2xs text-slate-600 font-mono">admin@valence.dev</p>
            <p className="text-2xs text-slate-600 font-mono">Admin1234!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
