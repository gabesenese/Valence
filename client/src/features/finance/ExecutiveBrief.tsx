import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { aiService } from '@/services/ai.service';


const HEALTH_CONFIG = {
  critical: { label: 'CRITICAL',  color: 'text-danger',   bg: 'bg-danger/10',  ring: 'ring-danger/30'   },
  at_risk:  { label: 'AT RISK',   color: 'text-warning',  bg: 'bg-warning/10', ring: 'ring-warning/30'  },
  stable:   { label: 'STABLE',    color: 'text-brand-400', bg: 'bg-brand-600/10', ring: 'ring-brand-500/30' },
  healthy:  { label: 'HEALTHY',   color: 'text-success',  bg: 'bg-success/10', ring: 'ring-success/30'  },
};


function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}


function Skeleton() {
  return (
    <div className="rounded-2xl border border-surface-400/40 bg-surface-100 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-400/30">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-surface-400/60" />
          <div className="h-4 w-36 rounded bg-surface-400/60" />
        </div>
        <div className="h-4 w-20 rounded bg-surface-400/40" />
      </div>
      <div className="px-6 py-5 space-y-3">
        <div className="h-5 w-3/4 rounded bg-surface-400/50" />
        <div className="h-3 w-full rounded bg-surface-400/30" />
        <div className="h-3 w-5/6 rounded bg-surface-400/30" />
      </div>
    </div>
  );
}


export default function ExecutiveBriefCard() {
  const [enabled, setEnabled] = useState(false);

  const { data: brief, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['ai', 'executive-brief'],
    queryFn:  aiService.getExecutiveBrief,
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    retry: 1,
  });

  const health = brief ? (HEALTH_CONFIG[brief.portfolioHealth] ?? HEALTH_CONFIG.stable) : null;

  if (!enabled && !brief) {
    return (
      <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-600/5 to-surface-100 overflow-hidden">
        <div className="px-5 py-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 ring-1 ring-brand-500/30">
              <Sparkles className="h-4 w-4 text-brand-400" />
            </div>
            <h3 className="text-sm font-semibold text-fg">Executive Intelligence Brief</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Claude analyzes your entire portfolio in real time — surfacing revenue risks,
            naming the leases that need attention today, and generating specific actions.
          </p>
          <button
            onClick={() => setEnabled(true)}
            className="self-start inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Brief
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || (enabled && !brief && !error)) return <Skeleton />;

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/20 bg-danger/5 px-6 py-5 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-danger">Brief generation failed</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {(error as Error).message ?? 'Something went wrong. Check your ANTHROPIC_API_KEY.'}
          </p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-brand-400 hover:text-brand-300">
            Try again →
          </button>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  return (
    <div className="rounded-2xl border border-surface-400/40 bg-surface-100 overflow-hidden">

      <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-400/30 bg-surface-200/30 sm:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-400" />
          <span className="text-sm font-semibold text-fg">Executive Brief</span>
          {health && (
            <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${health.bg} ${health.color} ${health.ring}`}>
              {health.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span>{timeAgo(brief.generatedAt)}</span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
            title="Regenerate"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <p className="text-lg font-semibold text-fg leading-snug">{brief.headline}</p>
        <p className="mt-2 max-w-3xl text-sm text-slate-400 leading-relaxed">{brief.summary}</p>
      </div>

    </div>
  );
}
