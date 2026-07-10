import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';

export default function RegisterPage({ trial = false }: { trial?: boolean }) {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.register(form);
      setAuth(result.user, result.tokens.accessToken, result.tokens.refreshToken);
      if (trial && result.user.role !== 'SUPER_ADMIN') {
        const claimed = await authService.claimTrial().catch(() => null);
        if (claimed) setAuth(claimed.user, claimed.tokens.accessToken, claimed.tokens.refreshToken);
      }
      navigate(result.user.role === 'SUPER_ADMIN' ? '/admin' : '/activate');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      if (data?.message === 'Validation failed' && data?.error) {
        try {
          const fields = JSON.parse(data.error) as Record<string, string[]>;
          const first = Object.values(fields).flat()[0];
          setError(first ?? 'Validation failed. Please check your inputs.');
        } catch {
          setError('Validation failed. Please check your inputs.');
        }
      } else if (data?.message) {
        setError(data.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo className="h-16 w-10" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-fg tracking-tight">Valence</h1>
            <p className="mt-0.5 text-xs text-slate-500">{trial ? 'Start your 7-day free trial' : 'Create your account'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-400/60 bg-surface-100/80 p-8 shadow-card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <Input label="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <div className="flex flex-col gap-1">
              <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              {form.password.length > 0 && form.password.length < 8 && (
                <p className="text-[11px] text-slate-500 px-1">{8 - form.password.length} more character{8 - form.password.length !== 1 ? 's' : ''} needed</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="mt-1 w-full">{trial ? 'Start free trial' : 'Create account'}</Button>
            {trial && (
              <p className="text-center text-[11px] text-slate-600">Full access for 7 days. No credit card required.</p>
            )}
          </form>
          <p className="mt-4 text-center text-xs text-slate-600">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-brand-400 hover:text-brand-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
