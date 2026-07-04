import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { VALENCE_COPILOT } from '@valence/shared';
import { FINANCE_COPILOT_ENABLED } from '@/config/flags';
import { usePlan } from '@/hooks/usePlan';
import { financeService, type RecommendationAction, type HealthBand } from '@/services/finance.service';
import { CopilotWorkspace } from './CopilotWorkspace';

const BAND_PHRASE: Record<HealthBand, string> = {
  HEALTHY: 'Your portfolio is healthy',
  WATCH: 'Your portfolio is steady, with a few things to watch',
  AT_RISK: 'Your portfolio needs attention',
};

const LEVER: Record<RecommendationAction, string> = {
  RENEW_LEASE: 'Renewals are your highest-impact opportunity right now.',
  COLLECT: 'Collecting overdue rent is the first move.',
  REVIEW_BUDGET: 'An over-budget property is worth a look.',
  SET_LATE_FEE_POLICY: 'Setting a late-fee policy is the quickest win.',
};

export function CopilotStrip() {
  const { hasAddon } = usePlan();
  const owns = FINANCE_COPILOT_ENABLED && hasAddon(VALENCE_COPILOT);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'analysis' | 'observations' | 'ask'>('analysis');

  const { data: intel } = useQuery({
    queryKey: ['finance', 'intelligence'],
    queryFn: () => financeService.getIntelligence(),
    enabled: owns,
  });

  if (!owns) return null;

  const band = intel?.health.band;
  const topRec = intel?.recommendations[0];
  const conclusion = band
    ? topRec
      ? `${BAND_PHRASE[band]}. ${LEVER[topRec.action]}`
      : `${BAND_PHRASE[band]}. Nothing needs your attention right now.`
    : 'Reading your portfolio…';

  function launch(next: 'analysis' | 'observations' | 'ask') {
    setMode(next);
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl border border-surface-400/50 bg-surface-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-brand-400" />
          <p className="truncate text-sm">
            <span className="font-semibold text-fg">Valence Copilot</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="text-slate-400">{band ? `“${conclusion}”` : conclusion}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 pl-6 sm:pl-0">
          <button
            onClick={() => launch('analysis')}
            className="text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
          >
            Analysis →
          </button>
          <button
            onClick={() => launch('observations')}
            className="text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
          >
            Patterns →
          </button>
          <button
            onClick={() => launch('ask')}
            className="text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
          >
            Ask →
          </button>
        </div>
      </div>

      <CopilotWorkspace open={open} onClose={() => setOpen(false)} initialMode={mode} />
    </>
  );
}
