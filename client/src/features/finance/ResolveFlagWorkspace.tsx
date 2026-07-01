import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { financeService } from '@/services/finance.service';
import { WorkspaceShell, WorkspaceSection, WorkspaceRecommendation, WorkspaceSuccess, type WorkspaceMeta } from '@/components/ui/WorkspaceShell';
import { formatCurrency, formatDate } from '@/utils/format';
import { categoryLabel } from '@valence/shared';

export function ResolveFlagWorkspace({ open, recordId, onClose }: { open: boolean; recordId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: record, isLoading } = useQuery({
    queryKey: ['finance', 'record', recordId],
    queryFn: () => financeService.getRecord(recordId!),
    enabled: open && !!recordId,
  });

  const resolve = useMutation({
    mutationFn: () => financeService.updateRecord(recordId!, { status: 'RECONCILED' }),
    onSuccess: () => qc.invalidateQueries(),
  });

  function handleClose() { resolve.reset(); onClose(); }
  function openProperty() { if (record) { handleClose(); navigate(`/properties/${record.property.id}`); } }

  const positive = record?.type === 'REVENUE';
  const title = record ? (record.description?.trim() || categoryLabel(record.category ?? undefined) || 'Transaction') : 'Resolve flag';
  const subtitle = record ? record.property.name : '';
  const meta: WorkspaceMeta[] = record ? [
    { label: 'Amount', value: `${positive ? '+' : '−'}${formatCurrency(record.amount)}`, tone: positive ? 'text-success' : 'text-slate-200' },
    { label: 'Type', value: positive ? 'Revenue' : 'Expense' },
    { label: 'Date', value: formatDate(record.paidDate ?? record.periodStart) },
  ] : [];

  const whyFlagged = record
    ? (record.discrepancy != null && record.discrepancy !== 0
        ? `Amount discrepancy of ${formatCurrency(Math.abs(record.discrepancy))} against the expected value.`
        : record.notes?.trim()
          ? record.notes
          : 'Flagged for manual review — confirm it belongs in the ledger.')
    : '';

  const footer = resolve.isSuccess ? (
    <div className="flex justify-end">
      <button type="button" onClick={handleClose} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500">Done</button>
    </div>
  ) : record ? (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={handleClose} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200">Keep flagged</button>
      <button
        type="button"
        onClick={() => resolve.mutate()}
        disabled={resolve.isPending}
        className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
      >
        {resolve.isPending ? 'Resolving…' : 'Mark resolved'}
      </button>
    </div>
  ) : null;

  return (
    <WorkspaceShell open={open} onClose={handleClose} eyebrow="Resolve Flag" title={title} subtitle={subtitle} meta={meta} footer={footer}>
      {resolve.isSuccess ? (
        <WorkspaceSuccess title="Transaction resolved" detail="It's reconciled and cleared from review." />
      ) : isLoading || !record ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <WorkspaceSection label="Why it's flagged">
            <p className="text-sm text-slate-300">{whyFlagged}</p>
          </WorkspaceSection>

          <WorkspaceRecommendation
            lines={['Mark resolved if the transaction is legitimate']}
            note="Resolving reconciles it; keeping it flagged leaves it in the review queue."
          />

          <WorkspaceSection label="If you resolve">
            <p className="text-sm text-slate-300">This transaction is reconciled and removed from the review count.</p>
          </WorkspaceSection>

          <WorkspaceSection label="Other paths">
            <div className="flex flex-col">
              <button type="button" onClick={openProperty} className="group flex items-center justify-between border-b border-surface-400/20 py-2.5 text-left text-sm text-slate-300 transition-colors last:border-0 hover:text-brand-300">
                Open property
                <ArrowRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300" />
              </button>
            </div>
          </WorkspaceSection>
        </>
      )}
    </WorkspaceShell>
  );
}
