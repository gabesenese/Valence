import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { leasesService } from '@/services/leases.service';
import { tasksService } from '@/services/tasks.service';
import { WorkspaceShell, WorkspaceSection, WorkspaceRecommendation, type WorkspaceMeta } from '@/components/ui/WorkspaceShell';
import { formatCurrency, compactCurrency, formatDate } from '@/utils/format';

const titleCase = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export function RenewalWorkspace({ open, leaseId, onClose }: { open: boolean; leaseId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [done, setDone] = useState<string | null>(null);

  const { data: lease, isLoading } = useQuery({
    queryKey: ['lease', leaseId],
    queryFn: () => leasesService.getLease(leaseId!),
    enabled: open && !!leaseId,
  });

  const after = (msg: string) => () => { qc.invalidateQueries(); setDone(msg); };

  const startRenewal = useMutation({ mutationFn: () => leasesService.startRenewal(leaseId!), onSuccess: after('Renewal started') });
  const markContacted = useMutation({ mutationFn: () => leasesService.markContacted(leaseId!), onSuccess: after('Marked contacted') });
  const createTask = useMutation({ mutationFn: () => tasksService.create({ title: `Renewal — ${lease?.tenant.name ?? 'lease'}`, leaseId: leaseId! }), onSuccess: after('Task created') });
  const scheduleFollowUp = useMutation({
    mutationFn: () => leasesService.setRenewalDateAction(leaseId!, new Date(Date.now() + 14 * 86_400_000).toISOString()),
    onSuccess: after('Follow-up scheduled in 2 weeks'),
  });

  function handleClose() { setDone(null); onClose(); }
  function openLease() { handleClose(); navigate(`/leases/${leaseId}`); }

  const pending = startRenewal.isPending || markContacted.isPending || createTask.isPending || scheduleFollowUp.isPending;

  const days = lease ? daysUntil(lease.endDate) : 0;
  const stage = lease?.renewalStage ?? 'NOT_STARTED';
  const notStarted = stage === 'NOT_STARTED';

  const title = lease ? lease.tenant.name : 'Renewal';
  const subtitle = lease ? lease.property.name : '';
  const meta: WorkspaceMeta[] = lease ? [
    { label: 'Expires', value: `${days} ${days === 1 ? 'day' : 'days'}`, tone: days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : 'text-slate-200' },
    { label: 'Current rent', value: `${formatCurrency(lease.baseRent)}/mo` },
    { label: 'Revenue at risk', value: compactCurrency(lease.baseRent * 12), tone: 'text-warning' },
  ] : [];

  const recLine = notStarted ? 'Start the renewal conversation' : stage === 'CONTACTED' ? 'Schedule a follow-up to keep momentum' : 'Keep the renewal moving';

  const primary = notStarted
    ? { label: 'Start renewal', run: () => startRenewal.mutate(undefined, { onSuccess: handleClose }) }
    : { label: 'Mark contacted', run: () => markContacted.mutate(undefined, { onSuccess: handleClose }) };

  const secondary = [
    notStarted ? { label: 'Mark contacted', run: () => markContacted.mutate() } : null,
    { label: 'Schedule follow-up', run: () => scheduleFollowUp.mutate() },
    { label: 'Create task', run: () => createTask.mutate() },
    { label: 'View lease', run: openLease },
  ].filter((a): a is { label: string; run: () => void } => a !== null);

  const footer = (
    <button
      type="button"
      onClick={primary.run}
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
    >
      {pending ? 'Working…' : primary.label}
    </button>
  );

  return (
    <WorkspaceShell open={open} onClose={handleClose} eyebrow="Lease Renewal" title={title} subtitle={subtitle} meta={meta} footer={lease ? footer : undefined}>
      {isLoading || !lease ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <WorkspaceSection label="Renewal stage">
            <p className="text-sm font-medium text-slate-200">{titleCase(stage)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {lease.lastContactedAt ? `Last contacted ${formatDate(lease.lastContactedAt)}` : 'Not yet contacted'}
              {lease.renewalScheduledAt ? ` · follow-up ${formatDate(lease.renewalScheduledAt)}` : ''}
            </p>
          </WorkspaceSection>

          <WorkspaceSection label="Market rent">
            <p className="text-sm text-slate-400">Unavailable</p>
            <p className="mt-0.5 text-xs text-slate-500">Connect market data or enter it on the lease to compare.</p>
          </WorkspaceSection>

          <WorkspaceRecommendation lines={[recLine]} note={`Expires in ${days} ${days === 1 ? 'day' : 'days'} · ${compactCurrency(lease.baseRent * 12)} annual revenue at risk.`} />

          <WorkspaceSection label="Actions">
            <div className="flex flex-col">
              {secondary.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.run}
                  disabled={pending}
                  className="group flex items-center justify-between border-b border-surface-400/20 py-2.5 text-left text-sm text-slate-300 transition-colors last:border-0 hover:text-brand-300 disabled:opacity-50"
                >
                  {a.label}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300" />
                </button>
              ))}
            </div>
          </WorkspaceSection>

          {done && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-success">
              <Check className="h-3.5 w-3.5" />{done}
            </p>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
