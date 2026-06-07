import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Valence</h1>
            <p className="mt-0.5 text-xs text-slate-500">Operational Intelligence Platform</p>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-400/60 bg-surface-100/80 p-8 shadow-card backdrop-blur-sm">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
              <h2 className="text-base font-semibold text-white">Check your email</h2>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                If <span className="text-slate-300">{email}</span> is registered, we've sent a password reset link. Check your spam folder if you don't see it.
              </p>
              <Link to="/auth/login" className="mt-6 inline-block text-xs text-brand-400 hover:text-brand-300 transition-colors">
                Back to sign in →
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-base font-semibold text-white">Reset your password</h2>
                <p className="mt-0.5 text-xs text-slate-500">Enter your email and we'll send a reset link.</p>
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

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                    <p className="text-xs text-danger">{error}</p>
                  </div>
                )}

                <Button type="submit" loading={loading} className="mt-1 w-full">
                  Send reset link
                </Button>
              </form>

              <div className="mt-4 text-center text-xs text-slate-600">
                <Link to="/auth/login" className="text-brand-400 hover:text-brand-300 transition-colors">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
