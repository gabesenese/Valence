import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, ArrowRight, X } from 'lucide-react';
import { onboardingService, type TipState } from '@/services/onboarding.service';

const KEY = 'invite-teammate';

export function InviteTeammatePrompt() {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    queryKey: ['onboarding', 'tips'],
    queryFn: onboardingService.getTipState,
    staleTime: 5 * 60 * 1000,
  });

  const mark = useMutation({
    mutationFn: () => onboardingService.markTipSeen(KEY),
    onSuccess: (next) =>
      qc.setQueryData<TipState>(['onboarding', 'tips'], (prev) => (prev ? { ...prev, seenTips: next } : prev)),
  });

  const signals = data?.signals;
  const seen = data?.seenTips?.includes(KEY);
  if (!data || dismissed || seen || !signals?.hasRealData || signals.hasInvitedTeammate) return null;

  function dismiss() {
    setDismissed(true);
    mark.mutate();
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-brand-500/25 bg-brand-600/[0.06] px-4 py-3 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600/15">
        <UserPlus className="h-4 w-4 text-brand-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">Invite a teammate</p>
        <p className="text-xs text-slate-400">Give your team shared visibility into the portfolio.</p>
      </div>
      <Link
        to="/organization"
        className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
      >
        Invite
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:text-slate-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
