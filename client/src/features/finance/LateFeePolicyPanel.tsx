import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { financeService } from '@/services/finance.service';
import { WorkspaceShell, WorkspaceSection, WorkspaceRecommendation, WorkspaceSuccess, type WorkspaceMeta } from '@/components/ui/WorkspaceShell';
import { formatCurrency } from '@/utils/format';

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export function LateFeePolicyPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [customize, setCustomize] = useState(false);
  const [feeType, setFeeType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [percent, setPercent] = useState('5');
  const [flat, setFlat] = useState('');
  const [graceDays, setGraceDays] = useState('5');

  const { data, isLoading } = useQuery({
    queryKey: ['finance', 'late-fee-policy', 'suggestion'],
    queryFn: () => financeService.getLateFeePolicySuggestion(),
    enabled: open,
  });

  const rec = data?.recommended;
  useEffect(() => {
    if (!rec) return;
    setFeeType(rec.feeType);
    setPercent(rec.percent != null ? String(rec.percent) : '');
    setFlat(rec.flat != null ? String(rec.flat) : '');
    setGraceDays(String(rec.graceDays));
  }, [rec]);

  const apply = useMutation({
    mutationFn: () => financeService.applyLateFeePolicy({
      feeType,
      percent: feeType === 'PERCENTAGE' ? Number(percent || 0) : null,
      flat: feeType === 'FLAT' ? Number(flat || 0) : null,
      graceDays: Number(graceDays || 0),
      leaseIds: data?.affectedLeases.map((l) => l.leaseId),
    }),
    onSuccess: () => qc.invalidateQueries(),
  });

  function handleClose() {
    apply.reset();
    setCustomize(false);
    onClose();
  }

  const count = data?.affectedCount ?? 0;
  const effectiveLabel = feeType === 'PERCENTAGE' ? `${percent || 0}% late fee` : `${formatCurrency(Number(flat || 0))} flat fee`;
  const basisNote = rec?.basis === 'portfolio' ? 'Based on your existing lease policies.' : 'A common commercial standard.';

  const title = data && count > 0
    ? (count === 1 ? data.affectedLeases[0].tenantName : `${count} leases`)
    : 'Late-fee policy';
  const subtitle = data && count === 1 ? data.affectedLeases[0].propertyName : 'No late-fee policy configured';
  const meta: WorkspaceMeta[] = data && count > 0
    ? [
      { label: 'Overdue', value: formatCurrency(data.overdueTotal), tone: 'text-warning' },
      { label: 'Affected', value: `${count} ${plural(count, 'lease')}` },
      { label: 'Current policy', value: 'None' },
    ]
    : [];

  const footer = apply.isSuccess ? (
    <div className="flex justify-end">
      <button type="button" onClick={handleClose} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500">Done</button>
    </div>
  ) : count > 0 ? (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={handleClose} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200">Cancel</button>
      <button
        type="button"
        onClick={() => apply.mutate()}
        disabled={apply.isPending}
        className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
      >
        {apply.isPending ? 'Applying…' : `Apply to ${count} ${plural(count, 'lease')}`}
      </button>
    </div>
  ) : null;

  return (
    <WorkspaceShell open={open} onClose={handleClose} eyebrow="Late-Fee Policy" title={title} subtitle={subtitle} meta={meta} footer={footer}>
      {apply.isSuccess ? (
        <WorkspaceSuccess
          title={`Policy applied to ${apply.data?.applied ?? count} ${plural(apply.data?.applied ?? count, 'lease')}`}
          detail="Future overdue invoices on these leases will accrue late fees automatically."
        />
      ) : isLoading || !data ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : count === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Every overdue lease already has a late-fee policy.</p>
      ) : (
        <>
          <WorkspaceSection label="Why you're seeing this">
            <p className="text-sm text-slate-300">No late-fee policy on {count} {plural(count, 'lease')}, so this balance accrues nothing.</p>
            <div className="mt-2 flex flex-col divide-y divide-surface-400/20 rounded-lg border border-surface-400/30">
              {data.affectedLeases.map((l) => (
                <div key={l.leaseId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">{l.tenantName}</p>
                    <p className="truncate text-[11px] text-slate-500">{l.propertyName}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-400">{formatCurrency(l.overdueAmount)} overdue</span>
                </div>
              ))}
            </div>
          </WorkspaceSection>

          <WorkspaceRecommendation lines={[effectiveLabel, `${graceDays || 0}-day grace period`]} note={basisNote} />

          <WorkspaceSection label="If you accept">
            <p className="text-sm text-slate-300">Future overdue invoices on {count === 1 ? 'this lease' : 'these leases'} will accrue fees automatically.</p>
          </WorkspaceSection>

          <button
            type="button"
            onClick={() => setCustomize((v) => !v)}
            className="flex items-center gap-1 self-start text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
          >
            Customize <ChevronDown className={`h-3.5 w-3.5 transition-transform ${customize ? 'rotate-180' : ''}`} />
          </button>

          {customize && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-surface-400/30 p-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-500">Fee type</span>
                <select
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value as 'PERCENTAGE' | 'FLAT')}
                  className="rounded-lg border border-surface-400/40 bg-surface-200 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-brand-500/50"
                >
                  <option value="PERCENTAGE">% of balance</option>
                  <option value="FLAT">Flat amount</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-500">{feeType === 'PERCENTAGE' ? 'Percent' : 'Amount'}</span>
                {feeType === 'PERCENTAGE' ? (
                  <input
                    value={percent}
                    onChange={(e) => setPercent(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    className="rounded-lg border border-surface-400/40 bg-surface-200 px-2.5 py-1.5 text-sm tabular-nums text-slate-200 outline-none focus:border-brand-500/50"
                  />
                ) : (
                  <input
                    value={flat}
                    onChange={(e) => setFlat(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    className="rounded-lg border border-surface-400/40 bg-surface-200 px-2.5 py-1.5 text-sm tabular-nums text-slate-200 outline-none focus:border-brand-500/50"
                  />
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-500">Grace period (days)</span>
                <input
                  value={graceDays}
                  onChange={(e) => setGraceDays(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  className="rounded-lg border border-surface-400/40 bg-surface-200 px-2.5 py-1.5 text-sm tabular-nums text-slate-200 outline-none focus:border-brand-500/50"
                />
              </label>
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
