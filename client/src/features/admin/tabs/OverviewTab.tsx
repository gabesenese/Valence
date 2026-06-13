import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Users, AlertTriangle, Activity } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { cn } from '@/utils/cn';

function fmt(n: number) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`; }

const PLAN_COLORS: Record<string, string> = {
  ESSENTIALS: 'bg-brand-500',
  PROFESSIONAL: 'bg-success',
  EXECUTIVE: 'bg-amber-400',
};

const STEP_LABELS: Record<string, string> = {
  visitor:        'Visitor',
  signup:         'Sign Up',
  demo_started:   'Demo Started',
  setup_complete: 'Setup Complete',
  data_imported:  'Data Imported',
  team_invited:   'Team Invited',
  upgrade_clicked:'Upgrade Clicked',
  upgraded:       'Upgraded',
};

function FunnelSection({ secret }: { secret: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'funnel', secret],
    queryFn: () => adminService.getFunnel(secret),
    staleTime: 60_000,
  });
  if (!data) return null;
  const maxUnique = Math.max(...data.map((s) => (s as { uniqueUsers?: number }).uniqueUsers ?? s.count), 1);
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Activation Funnel — Last 30 Days</h2>
      <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
        {data.map((step, i) => {
          const unique = (step as { uniqueUsers?: number }).uniqueUsers ?? step.count;
          return (
            <div key={step.step} className={cn('flex items-center gap-4 px-5 py-3', i > 0 && 'border-t border-surface-400/20')}>
              <div className="w-32 shrink-0">
                <p className="text-xs font-medium text-slate-300">{STEP_LABELS[step.step] ?? step.step}</p>
                {step.convRate !== null && (
                  <p className={cn('text-[10px] tabular-nums', step.convRate >= 30 ? 'text-success' : step.convRate >= 10 ? 'text-amber-400' : 'text-danger')}>
                    {step.convRate}% from prev
                  </p>
                )}
              </div>
              <div className="flex-1 h-2 rounded-full bg-surface-400/40 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', i === 0 ? 'bg-brand-400' : 'bg-brand-500/70')}
                  style={{ width: `${maxUnique > 0 ? (unique / maxUnique) * 100 : 0}%` }}
                />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-white">{unique}</p>
                {step.count !== unique && (
                  <p className="text-[10px] text-slate-600 tabular-nums">{step.count} events</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-600">Numbers show unique users per step. Event counts shown below where different.</p>
    </div>
  );
}

export function OverviewTab({ secret }: { secret: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'analytics', secret],
    queryFn: () => adminService.getAnalytics(secret),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-24 text-xs text-slate-500">Loading analytics…</div>;
  }

  const totalUsers = Object.values(data.planDist).reduce((a, b) => a + b, 0);
  const maxBar = Math.max(...data.signupTrend.map((d) => d.count), 1);

  return (
    <div className="space-y-8">
      {/* Funnel */}
      <FunnelSection secret={secret} />

      {/* Revenue KPIs */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Revenue</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'MRR', value: fmt(data.mrr), icon: DollarSign, up: true },
            { label: 'ARR', value: fmt(data.arr), icon: TrendingUp, up: true },
            { label: 'Total Accounts', value: totalUsers, icon: Users, up: null },
            { label: 'Trial Conv. Rate', value: `${data.trialConvRate}%`, icon: Activity, up: data.trialConvRate > 20 },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-surface-400/40 bg-surface-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-slate-500">{k.label}</p>
                <k.icon className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <p className="text-2xl font-bold text-white tabular-nums">{k.value}</p>
              {k.up !== null && (
                <p className={cn('mt-1 text-[10px] font-medium', k.up ? 'text-success' : 'text-danger')}>
                  {k.up ? '↑ Growing' : '↓ Below target'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Plan distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-surface-400/40 bg-surface-100 p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Plan Distribution</h3>
          <div className="space-y-3">
            {Object.entries(data.planDist).map(([plan, count]) => {
              const pct = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-300">{plan}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-400/40 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', PLAN_COLORS[plan] ?? 'bg-slate-500')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Churn signals */}
        <div className="rounded-xl border border-surface-400/40 bg-surface-100 p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Churn Signals</h3>
          <div className="space-y-3">
            {[
              { label: 'Inactive 14+ days', value: data.churn.inactive14, severity: 'warning' },
              { label: 'Inactive 30+ days', value: data.churn.inactive30, severity: 'high' },
              { label: 'Inactive 60+ days', value: data.churn.inactive60, severity: 'critical' },
            ].map((c) => (
              <div key={c.label} className="flex items-center justify-between rounded-lg border border-surface-400/30 bg-surface-200/50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={cn('h-3.5 w-3.5', c.severity === 'critical' ? 'text-danger' : c.severity === 'high' ? 'text-amber-400' : 'text-warning')} />
                  <span className="text-xs text-slate-400">{c.label}</span>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', c.value > 0 ? (c.severity === 'critical' ? 'text-danger' : 'text-amber-400') : 'text-slate-600')}>
                  {c.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signup trend */}
      <div className="rounded-xl border border-surface-400/40 bg-surface-100 p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Signups — Last 30 Days</h3>
        <div className="flex items-end gap-1 h-24">
          {data.signupTrend.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-t-sm bg-brand-500/60 hover:bg-brand-400 transition-colors"
                style={{ height: `${(d.count / maxBar) * 80}px`, minHeight: d.count > 0 ? '3px' : '0' }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface-300 rounded px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap z-10">
                {d.date.slice(5)} · {d.count}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-600">
          <span>{data.signupTrend[0]?.date.slice(5)}</span>
          <span>{data.signupTrend[data.signupTrend.length - 1]?.date.slice(5)}</span>
        </div>
      </div>

      {/* Cohorts */}
      <div className="rounded-xl border border-surface-400/40 bg-surface-100 p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Signup Cohorts — Last 12 Weeks</h3>
        {data.cohorts.length === 0 ? (
          <p className="text-xs text-slate-600">No cohort data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.cohorts.map((c) => (
              <div key={c.week} className="rounded-lg border border-surface-400/30 bg-surface-200/50 px-3 py-2 text-center min-w-[72px]">
                <p className="text-lg font-bold text-white tabular-nums">{c.users}</p>
                <p className="text-[10px] text-slate-500">{c.week}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feature adoption */}
      <div className="rounded-xl border border-surface-400/40 bg-surface-100 p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Feature Adoption (unique accounts)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Properties', value: data.adoption.withProperties },
            { label: 'Leases', value: data.adoption.withLeases },
            { label: 'Alerts', value: data.adoption.withAlerts },
            { label: 'Tasks', value: data.adoption.withTasks },
            { label: 'AI Usage', value: data.adoption.withAI },
          ].map((a) => (
            <div key={a.label} className="rounded-lg border border-surface-400/30 bg-surface-200/50 px-3 py-3 text-center">
              <p className="text-xl font-bold text-white tabular-nums">{a.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{a.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Slow accounts */}
      {data.slowAccounts.length > 0 && (
        <div className="rounded-xl border border-surface-400/40 bg-surface-100 p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Top Accounts by Data Volume</h3>
          <div className="space-y-2">
            {data.slowAccounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-surface-400/20 bg-surface-200/40 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-slate-200">{a.firstName} {a.lastName}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{a.email}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{a._count.ownedProperties}p</span>
                  <span>{a._count.ownedLeases}l</span>
                  <span>{a._count.ownedTenants}t</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
