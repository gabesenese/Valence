import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { aiService, type PortfolioHealthScore } from '@/services/ai.service';

// ─── Config ───────────────────────────────────────────────────────────────────

const BAND_CONFIG = {
  critical: { label: 'CRITICAL',  ring: '#ef4444', text: 'text-danger',    bg: 'bg-danger/10'    },
  at_risk:  { label: 'AT RISK',   ring: '#f59e0b', text: 'text-warning',   bg: 'bg-warning/10'   },
  stable:   { label: 'STABLE',    ring: '#6366f1', text: 'text-brand-400', bg: 'bg-brand-600/10' },
  healthy:  { label: 'HEALTHY',   ring: '#10b981', text: 'text-success',   bg: 'bg-success/10'   },
};

// ─── Gauge arc ────────────────────────────────────────────────────────────────

function ScoreGauge({ score, band }: { score: number; band: PortfolioHealthScore['band'] }) {
  const cfg   = BAND_CONFIG[band];
  const r     = 52;
  const cx    = 64;
  const cy    = 64;
  const circ  = 2 * Math.PI * r;
  const arc   = circ * 0.75;
  const fill  = arc * (score / 100);
  const offset = circ * 0.125;

  return (
    <div className="relative flex items-center justify-center w-32 h-32 shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e3a" strokeWidth="10"
          strokeDasharray={`${arc} ${circ - arc}`} strokeDashoffset={-offset} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={cfg.ring} strokeWidth="10"
          strokeDasharray={`${fill} ${circ - fill}`} strokeDashoffset={-offset} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white tabular-nums leading-none">{score}</span>
        <span className="text-[10px] text-slate-500 tracking-widest mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-2xl border border-surface-400/40 bg-surface-100 p-5 animate-pulse">
      <div className="flex items-center gap-5">
        <div className="h-32 w-32 rounded-full bg-surface-400/30 shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-40 rounded bg-surface-400/40" />
          <div className="space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-4 rounded bg-surface-400/20" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HealthScoreCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai', 'health-score'],
    queryFn:  aiService.getHealthScore,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton />;
  if (!data) return null;

  const cfg        = BAND_CONFIG[data.band];
  const TrendIcon  = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data.trend === 'up' ? 'text-success' : data.trend === 'down' ? 'text-danger' : 'text-slate-500';

  // Derive risks (lowest score ratio) and strengths (highest score ratio)
  const sorted    = [...data.components].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore));
  const risks     = sorted.slice(0, 2);
  const strengths = sorted.slice(-2).reverse();

  return (
    <div className="rounded-2xl border border-surface-400/40 bg-surface-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-400/30 bg-surface-200/30">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-400" />
          <span className="text-sm font-semibold text-white">Portfolio Health</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${cfg.text} ${cfg.bg}`}>
            {cfg.label}
          </span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{data.delta >= 0 ? '+' : ''}{data.delta} this month</span>
        </div>
      </div>

      {/* Gauge + Risks/Strengths */}
      <div className="flex items-center gap-6 px-5 py-5">
        <ScoreGauge score={data.score} band={data.band} />
        <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1">
          {/* Risks */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <ShieldAlert className="h-3.5 w-3.5 text-danger/70" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Main Risks</span>
            </div>
            <ul className="flex flex-col gap-2">
              {risks.map(r => (
                <li key={r.name} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger/60" />
                  {r.label}
                </li>
              ))}
            </ul>
          </div>
          {/* Strengths */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success/70" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Strengths</span>
            </div>
            <ul className="flex flex-col gap-2">
              {strengths.map(s => (
                <li key={s.name} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success/60" />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
