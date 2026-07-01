import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { financeService, type CollectionAction, type RecoveryBand } from '@/services/finance.service';
import { tasksService } from '@/services/tasks.service';
import { WorkspaceShell, WorkspaceSection, WorkspaceRecommendation, type WorkspaceMeta } from '@/components/ui/WorkspaceShell';
import { formatCurrency, formatDate } from '@/utils/format';

const PRIMARY_LABEL: Record<CollectionAction, string> = {
  REMIND: 'Send reminder',
  APPLY_FEE: 'Apply late fee',
  ESCALATE: 'Escalate',
  RECORD: 'Record payment',
};

const BAND: Record<RecoveryBand, { label: string; cls: string }> = {
  HIGH: { label: 'High', cls: 'text-success' },
  MEDIUM: { label: 'Medium', cls: 'text-warning' },
  LOW: { label: 'Low', cls: 'text-danger' },
};

export function CollectionsWorkspace({ open, leaseId, onClose }: { open: boolean; leaseId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [done, setDone] = useState<string | null>(null);

  const { data: ctx, isLoading } = useQuery({
    queryKey: ['finance', 'collections', leaseId],
    queryFn: () => financeService.getCollections(leaseId!),
    enabled: open && !!leaseId,
  });

  const invalidate = () => qc.invalidateQueries();
  const remind = useMutation({ mutationFn: () => financeService.collectionsRemind(leaseId!), onSuccess: invalidate });
  const recordPayment = useMutation({ mutationFn: () => financeService.collectionsRecordPayment(leaseId!), onSuccess: invalidate });
  const applyFee = useMutation({ mutationFn: () => financeService.collectionsApplyLateFee(leaseId!), onSuccess: invalidate });
  const createTask = useMutation({ mutationFn: () => tasksService.create({ title: `Collections follow-up — ${ctx?.tenantName ?? 'lease'}`, leaseId: leaseId! }), onSuccess: invalidate });

  const pending = remind.isPending || recordPayment.isPending || applyFee.isPending || createTask.isPending;

  function handleClose() { setDone(null); onClose(); }
  function viewLease() { handleClose(); navigate(`/leases/${leaseId}`); }

  function runAction(action: CollectionAction, close: boolean) {
    const opts = { onSuccess: close ? handleClose : () => setDone(`${PRIMARY_LABEL[action]} done`) };
    if (action === 'REMIND') remind.mutate(undefined, opts);
    else if (action === 'RECORD') recordPayment.mutate(undefined, opts);
    else if (action === 'APPLY_FEE') applyFee.mutate(undefined, opts);
    else createTask.mutate(undefined, { onSuccess: close ? handleClose : () => setDone('Follow-up created') });
  }

  const primaryAction = ctx?.recommendation.action ?? 'REMIND';
  const meta: WorkspaceMeta[] = ctx ? [
    { label: 'Outstanding', value: formatCurrency(ctx.outstandingBalance), tone: 'text-danger' },
    { label: 'Overdue', value: `${ctx.daysOverdue} ${ctx.daysOverdue === 1 ? 'day' : 'days'}` },
    { label: 'Monthly rent', value: formatCurrency(ctx.monthlyRent) },
  ] : [];

  const secondaries = ctx
    ? ([
        { action: 'RECORD' as CollectionAction, label: 'Record payment', run: () => runAction('RECORD', true) },
        { action: 'REMIND' as CollectionAction, label: 'Send reminder', run: () => runAction('REMIND', false) },
        { action: 'ESCALATE' as CollectionAction, label: 'Create follow-up', run: () => runAction('ESCALATE', false) },
      ].filter((s) => s.action !== primaryAction))
    : [];

  const footer = ctx ? (
    <button type="button" onClick={() => runAction(primaryAction, true)} disabled={pending}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50">
      {pending ? 'Working…' : PRIMARY_LABEL[primaryAction]}
    </button>
  ) : undefined;

  return (
    <WorkspaceShell open={open} onClose={handleClose} eyebrow="Collections" title={ctx?.tenantName ?? 'Collections'} subtitle={ctx?.propertyName} meta={meta} footer={footer}>
      {isLoading || !ctx ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="rounded-lg border border-surface-400/30 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Recovery</span>
              <span className={`text-sm font-bold ${BAND[ctx.recovery.band].cls}`}>{BAND[ctx.recovery.band].label}</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {ctx.recovery.reasons.map((r) => (
                <li key={r} className="flex items-center gap-2 text-xs text-slate-400"><span className="h-1 w-1 shrink-0 rounded-full bg-slate-600" />{r}</li>
              ))}
            </ul>
          </div>

          <WorkspaceRecommendation lines={[PRIMARY_LABEL[primaryAction]]} note={ctx.recommendation.reason} />

          <WorkspaceSection label="Context">
            <div className="flex flex-col divide-y divide-surface-400/20 text-sm">
              <Row label="Monthly rent" value={formatCurrency(ctx.monthlyRent)} />
              <Row label="Outstanding balance" value={formatCurrency(ctx.outstandingBalance)} valueCls="text-danger font-semibold" />
              <Row label="Late fees" value={ctx.lateFeeConfigured ? 'Configured' : 'None configured'} />
              <Row label="Last reminder" value={ctx.lastReminderAt ? formatDate(ctx.lastReminderAt) : 'Never'} />
              {(ctx.contactEmail || ctx.contactPhone) && <Row label="Contact" value={ctx.contactEmail ?? ctx.contactPhone ?? '—'} />}
            </div>
          </WorkspaceSection>

          <WorkspaceSection label="History">
            <div className="flex flex-col gap-2.5">
              {ctx.history.map((h, i) => (
                <div key={`${h.label}-${i}`} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-[11px] tabular-nums text-slate-500">{formatDate(h.date)}</span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                  <span className="text-sm text-slate-300">{h.label}</span>
                </div>
              ))}
            </div>
          </WorkspaceSection>

          <WorkspaceSection label="Other actions">
            <div className="flex flex-col">
              {secondaries.map((s) => (
                <button key={s.action} type="button" onClick={s.run} disabled={pending}
                  className="group flex items-center justify-between border-b border-surface-400/20 py-2.5 text-left text-sm text-slate-300 transition-colors last:border-0 hover:text-brand-300 disabled:opacity-50">
                  {s.label}<ArrowRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300" />
                </button>
              ))}
              <button type="button" onClick={viewLease} className="group flex items-center justify-between border-b border-surface-400/20 py-2.5 text-left text-sm text-slate-300 transition-colors last:border-0 hover:text-brand-300">
                View lease<ArrowRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300" />
              </button>
            </div>
          </WorkspaceSection>

          {done && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-success"><Check className="h-3.5 w-3.5" />{done}</p>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}

function Row({ label, value, valueCls = 'text-slate-200' }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${valueCls}`}>{value}</span>
    </div>
  );
}
