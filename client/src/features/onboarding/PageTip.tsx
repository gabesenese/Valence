import { useState, useLayoutEffect, useRef, type RefObject } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, ArrowRight } from 'lucide-react';
import { onboardingService, type OnboardingSignals, type TipState } from '@/services/onboarding.service';

const TIPS: Record<string, { title: string; body: string }> = {
  finance: {
    title: 'Start with what’s flagged',
    body: 'Finance shows where money leaks first. Act on the flags, not the totals.',
  },
  forecast: {
    title: 'Protect future revenue',
    body: 'Renew the leases closest to expiration before they become revenue risks.',
  },
  expenses: {
    title: 'Small savings compound',
    body: 'Review over-budget categories before reducing spending elsewhere.',
  },
  profitability: {
    title: 'Revenue isn’t profit',
    body: 'Improve your weakest-performing tenants, not just your highest-paying ones.',
  },
  ledger: {
    title: 'Keep records clean',
    body: 'Resolve flagged transactions before closing the month.',
  },
  budgets: {
    title: 'Plan before spending',
    body: 'Set monthly limits once, then manage the exceptions.',
  },
  'work-queue': {
    title: 'Priorities before anything else',
    body: 'It’s ranked by impact. Clear the top item before you move on.',
  },
  dashboard: {
    title: 'Priorities first',
    body: 'Complete today’s highest-impact work before reviewing anything else.',
  },
  properties: {
    title: 'Know every asset',
    body: 'Review each property’s health before acting on individual leases or tasks.',
  },
  leases: {
    title: 'Leases are your revenue',
    body: 'Track every expiry before it turns into a vacancy.',
  },
  tenants: {
    title: 'Relationships renew leases',
    body: 'Focus on tenants approaching renewal first.',
  },
  tasks: {
    title: 'Nothing improves until someone acts',
    body: 'Assign follow-ups so the work actually gets done.',
  },
  crm: {
    title: 'Renewals start early',
    body: 'Reach out well before a lease ends — the best renewals aren’t rushed.',
  },
  analytics: {
    title: 'Watch what’s moving',
    body: 'Don’t just read today’s numbers — watch what’s changed since your last visit.',
  },
  performance: {
    title: 'Compare to focus',
    body: 'See which properties lead and lag, then put attention where it pays.',
  },
  automation: {
    title: 'Save time',
    body: 'Repeated a task twice? It’s probably worth automating.',
  },
  alerts: {
    title: 'Signals become losses',
    body: 'Resolve what’s flagged here before it costs you.',
  },
  documents: {
    title: 'Documents tell the story',
    body: 'Keep leases and contracts organized so every decision has evidence behind it.',
  },
  copilot: {
    title: 'Ask, don’t dig',
    body: 'Your portfolio’s loaded — now Copilot can answer questions about it in plain English.',
  },
};

const TIP_GATE: Record<string, { signal?: keyof OnboardingSignals; afterTip?: string }> = {
  automation: { signal: 'repeatedWork' },
  copilot: { signal: 'hasRealData', afterTip: 'finance' },
};

const ALIGN_BEAK: Record<'start' | 'center' | 'end', string> = {
  start: '28px',
  center: '50%',
  end: 'calc(100% - 28px)',
};

export function PageTip({
  tipKey,
  anchorRef,
  align = 'start',
  beakSide = 'top',
}: {
  tipKey: string;
  anchorRef?: RefObject<HTMLElement | null>;
  align?: 'start' | 'center' | 'end';
  beakSide?: 'top' | 'bottom';
}) {
  const qc = useQueryClient();
  const content = TIPS[tipKey];
  const [dismissed, setDismissed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [beakLeft, setBeakLeft] = useState<number | null>(null);

  const { data: tipState } = useQuery({
    queryKey: ['onboarding', 'tips'],
    queryFn: onboardingService.getTipState,
    staleTime: 5 * 60 * 1000,
  });
  const seenTips = tipState?.seenTips;
  const signals = tipState?.signals;

  const mark = useMutation({
    mutationFn: () => onboardingService.markTipSeen(tipKey),
    onSuccess: (next) =>
      qc.setQueryData<TipState>(['onboarding', 'tips'], (prev) =>
        prev ? { ...prev, seenTips: next } : prev,
      ),
  });

  const gate = TIP_GATE[tipKey];
  const earned =
    !gate ||
    ((!gate.signal || signals?.[gate.signal] === true) &&
      (!gate.afterTip || seenTips?.includes(gate.afterTip) === true));

  const visible =
    Boolean(content) && !dismissed && Boolean(tipState) && !seenTips?.includes(tipKey) && earned;

  useLayoutEffect(() => {
    if (!visible) return;
    const compute = () => {
      const anchor = anchorRef?.current;
      const wrap = wrapRef.current;
      if (!anchor || !wrap) {
        setBeakLeft(null);
        return;
      }
      const a = anchor.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      const center = a.left + a.width / 2 - w.left;
      setBeakLeft(Math.max(18, Math.min(center, w.width - 18)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [visible, anchorRef, tipKey]);

  if (!visible) return null;

  function gotIt() {
    setDismissed(true);
    mark.mutate();
  }

  const beak = beakLeft != null ? `${beakLeft}px` : ALIGN_BEAK[align];
  const bottom = beakSide === 'bottom';

  return (
    <div ref={wrapRef} className={`relative ${bottom ? 'mb-2' : 'mt-2'} animate-fade-in`}>
      <div
        className={`absolute h-3 w-3 border-brand-500/30 bg-surface-100 ${
          bottom ? '-bottom-1.5 border-b border-r' : '-top-1.5 border-l border-t'
        }`}
        style={{ left: beak, transform: 'translateX(-50%) rotate(45deg)' }}
      />
      <div className="relative flex items-center gap-3 rounded-xl border border-brand-500/30 bg-surface-100 px-3.5 py-2.5 shadow-glow-brand">
        <Sparkles className="h-4 w-4 shrink-0 text-brand-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-fg">{content.title}</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-400">{content.body}</p>
        </div>
        <button
          onClick={gotIt}
          className="group/tip shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
        >
          Got it
          <ArrowRight className="h-3 w-3 transition-transform group-hover/tip:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
