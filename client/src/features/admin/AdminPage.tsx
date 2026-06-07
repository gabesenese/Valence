import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Lock, RefreshCw, BarChart2, Users, Activity, Flag, Cpu,
  Eye, EyeOff, Loader2, TrendingUp, CheckCircle2,
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { useAuthStore } from '@/state/auth.store';
import { cn } from '@/utils/cn';
import { OverviewTab } from './tabs/OverviewTab';
import { UsersTab } from './tabs/UsersTab';
import { ActivityTab } from './tabs/ActivityTab';
import { PlatformTab } from './tabs/PlatformTab';
import { SystemTab } from './tabs/SystemTab';

const SECRET_KEY = 'valence-admin-secret';

type Tab = 'overview' | 'users' | 'activity' | 'platform' | 'system';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview',  label: 'Overview',  icon: BarChart2 },
  { id: 'users',     label: 'Users',     icon: Users     },
  { id: 'activity',  label: 'Activity',  icon: Activity  },
  { id: 'platform',  label: 'Platform',  icon: Flag      },
  { id: 'system',    label: 'System',    icon: Cpu       },
];

// ─── Secret gate ──────────────────────────────────────────────────────────────

function SecretGate({ onUnlock }: { onUnlock: (s: string) => void }) {
  const [value, setValue]   = useState('');
  const [show, setShow]     = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    try {
      await adminService.getStats(value.trim());
      sessionStorage.setItem(SECRET_KEY, value.trim());
      onUnlock(value.trim());
    } catch {
      setError('Invalid secret or insufficient permissions.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="rounded-2xl border border-surface-400/60 bg-surface-100/80 p-8 shadow-card">
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/10 border border-brand-500/30">
              <Shield className="h-6 w-6 text-brand-400" />
            </div>
            <div className="text-center">
              <h1 className="text-base font-bold text-white">Platform Admin</h1>
              <p className="mt-0.5 text-xs text-slate-500">Enter your admin secret to continue</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Admin secret"
                autoFocus
                className="h-10 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 pr-10 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="h-10 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-glow-brand hover:bg-brand-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {loading ? 'Verifying…' : 'Enter Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [secret, setSecret] = useState<string | null>(null);
  const [tab, setTab]       = useState<Tab>('overview');

  useEffect(() => {
    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: '/admin' } }, replace: true });
    } else if (user.role !== 'SUPER_ADMIN') {
      navigate('/queue', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const stored = sessionStorage.getItem(SECRET_KEY);
    if (stored) setSecret(stored);
  }, []);

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats', secret],
    queryFn: () => adminService.getStats(secret!),
    enabled: !!secret,
    staleTime: 60_000,
  });

  function lock() {
    sessionStorage.removeItem(SECRET_KEY);
    setSecret(null);
  }

  if (!secret) return <SecretGate onUnlock={setSecret} />;

  return (
    <div className="min-h-screen bg-surface-0 text-white">
      {/* Header */}
      <header className="border-b border-surface-400/20 bg-surface-50/60 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-brand-400" />
            <span className="text-sm font-bold text-white">Platform Admin</span>
            <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-bold text-danger">RESTRICTED</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['admin'] })}
              className="flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              onClick={lock}
              className="flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-1.5 text-xs text-slate-400 hover:text-danger transition-colors"
            >
              <Lock className="h-3.5 w-3.5" /> Lock
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Stats strip */}
        {stats && (
          <div className="mb-6 grid grid-cols-4 gap-3 sm:grid-cols-8">
            {[
              { label: 'Total Users',   value: stats.totalUsers,                    icon: Users },
              { label: 'Signups Today', value: stats.signupsToday,                  icon: TrendingUp },
              { label: 'Signups 7d',    value: stats.signups7d,                     icon: TrendingUp },
              { label: 'Active Trials', value: stats.activeTrials,                  icon: CheckCircle2 },
              { label: 'Essentials',    value: stats.byPlan['ESSENTIALS']   ?? 0,   icon: null },
              { label: 'Professional',  value: stats.byPlan['PROFESSIONAL'] ?? 0,   icon: null },
              { label: 'Executive',     value: stats.byPlan['EXECUTIVE']    ?? 0,   icon: null },
              { label: 'Email Verified',value: stats.emailVerified,                 icon: null },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-surface-400/40 bg-surface-100 px-3 py-3 text-center">
                <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-surface-400/30 bg-surface-100/60 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                tab === id
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-200/60',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview'  && <OverviewTab  secret={secret} />}
        {tab === 'users'     && <UsersTab     secret={secret} />}
        {tab === 'activity'  && <ActivityTab  secret={secret} />}
        {tab === 'platform'  && <PlatformTab  secret={secret} />}
        {tab === 'system'    && <SystemTab    secret={secret} />}
      </div>
    </div>
  );
}
