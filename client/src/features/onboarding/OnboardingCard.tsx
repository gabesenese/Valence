import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, X, Building2, FileText, Users } from 'lucide-react';
import { onboardingService } from '@/services/onboarding.service';
import { useAuthStore } from '@/state/auth.store';

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-surface-400/40 bg-surface-200/40 px-3 py-3">
      <Icon className="h-4 w-4 text-success" />
      <span className="text-lg font-bold text-fg tabular-nums">{value}</span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

export function OnboardingCard() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id ?? 'anon');

  const DISMISS_KEY = `valence-onboarding-dismissed-${userId}`;
  const COMPLETE_KEY = `valence-onboarding-complete-seen-${userId}`;

  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [completeSeen, setCompleteSeen] = useState(() => localStorage.getItem(COMPLETE_KEY) === '1');

  const { data } = useQuery({
    queryKey: ['onboarding', 'progress'],
    queryFn: onboardingService.getProgress,
    staleTime: 30_000,
  });

  if (dismissed || completeSeen || !data) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  function dismissComplete() {
    localStorage.setItem(COMPLETE_KEY, '1');
    setCompleteSeen(true);
  }


  if (data.allDone) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold text-fg">Portfolio Setup Complete</h3>
          </div>
          <button
            onClick={dismissComplete}
            className="text-slate-600 hover:text-slate-400 transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatPill icon={Building2} value={data.counts.properties} label="Properties" />
          <StatPill icon={FileText} value={data.counts.leases} label="Leases" />
          <StatPill icon={Users} value={data.counts.invites + 1} label="Team Members" />
        </div>

        <p className="text-xs text-slate-500 mb-4">Your portfolio intelligence is now active.</p>

        <Link
          to="/queue"
          onClick={dismissComplete}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors shadow-glow-brand"
        >
          View Work Queue <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }


  return (
    <div className="rounded-2xl border border-surface-400/40 bg-surface-100 p-5">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-fg">Get Started with Valence</h3>
        <button
          onClick={dismiss}
          className="text-slate-600 hover:text-slate-400 transition-colors mt-0.5"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        {data.completed} of {data.total} complete · {data.percent}%
      </p>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-400/40 mb-5">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-500 transition-all duration-700"
          style={{ width: `${data.percent}%` }}
        />
      </div>

      <div className="flex flex-col gap-1">
        {data.milestones.map((m) => (
          <div
            key={m.id}
            role={!m.done && m.href ? 'button' : undefined}
            tabIndex={!m.done && m.href ? 0 : undefined}
            onClick={() => !m.done && m.href && navigate(m.href)}
            onKeyDown={(e) => e.key === 'Enter' && !m.done && m.href && navigate(m.href)}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
              !m.done && m.href ? 'cursor-pointer hover:bg-surface-200/60 group' : '',
              m.done ? 'opacity-55' : '',
            ].join(' ')}
          >
            {m.done
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              : <Circle className="h-4 w-4 shrink-0 text-slate-600" />
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-xs font-medium leading-snug ${m.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {m.label}
                </p>
                {m.optional && !m.done && (
                  <span className="rounded-full border border-surface-500/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    Optional
                  </span>
                )}
              </div>
              {!m.done && (
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{m.description}</p>
              )}
            </div>
            {!m.done && m.cta && (
              <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-semibold text-brand-400 group-hover:text-brand-300 transition-colors">
                {m.cta}
                <ChevronRight className="h-3 w-3" />
              </span>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={dismiss}
        className="mt-4 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
      >
        I'm All Set
      </button>
    </div>
  );
}
