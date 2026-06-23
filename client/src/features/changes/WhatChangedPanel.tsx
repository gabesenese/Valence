import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { History, X } from 'lucide-react';
import { changesService } from '@/services/changes.service';

const PILL: Record<string, string> = {
  tasks:   'text-success bg-success/10',
  revenue: 'text-info bg-info/10',
  alerts:  'text-warning bg-warning/10',
  risk:    'text-danger bg-danger/10',
};

export function WhatChangedPanel() {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    queryKey: ['changes', 'since'],
    queryFn: changesService.getSince,
    staleTime: 60_000,
  });

  const seen = useMutation({
    mutationFn: () => changesService.markSeen(data!.asOf),
    onSuccess: () => {
      setDismissed(true);
      qc.invalidateQueries({ queryKey: ['changes'] });
    },
  });

  if (!data || data.firstVisit || data.total === 0 || dismissed) return null;

  return (
    <div className="rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-400/30 bg-surface-200/30">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-brand-400" />
          <span className="text-sm font-semibold text-fg">Since your last visit</span>
          <span className="text-xs text-slate-500">{data.total} update{data.total > 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => seen.mutate()}
          disabled={seen.isPending}
          aria-label="Dismiss"
          className="text-slate-500 hover:text-fg transition-colors disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="divide-y divide-surface-400/30">
        {data.groups.map((g, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${PILL[g.kind] ?? 'text-slate-500 bg-surface-300'}`}>{g.pill}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg truncate">{g.title}</p>
              {g.detail && <p className="text-xs text-slate-500 truncate">{g.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
