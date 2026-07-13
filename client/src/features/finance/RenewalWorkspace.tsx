import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Mail, CalendarCheck } from 'lucide-react';
import { leasesService } from '@/services/leases.service';
import { tasksService } from '@/services/tasks.service';
import { WorkspaceShell, WorkspaceSection, WorkspaceRecommendation, type WorkspaceMeta } from '@/components/ui/WorkspaceShell';
import { EmailTenantModal } from '@/features/crm/EmailTenantModal';
import { formatCurrency, compactCurrency, formatDate } from '@/utils/format';

const titleCase = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export function RenewalWorkspace({ open, leaseId, onClose }: { open: boolean; leaseId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [done, setDone] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const { data: lease, isLoading, isError } = useQuery({
    queryKey: ['lease', leaseId],
    queryFn: () => leasesService.getLease(leaseId!),
    enabled: open && !!leaseId,
  });

  const after = (msg: string) => () => { qc.invalidateQueries(); setDone(msg); };

  const followUpTarget = new Date(Date.now() + 14 * 86_400_000);

  const startRenewal = useMutation({ mutationFn: () => leasesService.startRenewal(leaseId!), onSuccess: after('Renewal started') });
  const markContacted = useMutation({ mutationFn: () => leasesService.markContacted(leaseId!), onSuccess: after('Marked contacted') });
  const createTask = useMutation({ mutationFn: () => tasksService.create({ title: `Renewal — ${lease?.tenant.name ?? 'lease'}`, leaseId: leaseId! }), onSuccess: after('Task created') });
  const scheduleFollowUp = useMutation({
    mutationFn: () => leasesService.setRenewalDateAction(leaseId!, followUpTarget.toISOString()),
    onSuccess: after(`Follow-up scheduled for ${formatDate(followUpTarget.toISOString())}`),
  });

  function handleClose() { setDone(null); setEmailOpen(false); onClose(); }
  function openLease() { handleClose(); navigate(`/leases/${leaseId}`); }

  const pending = startRenewal.isPending || markContacted.isPending || createTask.isPending || scheduleFollowUp.isPending;

  const days = lease ? daysUntil(lease.endDate) : 0;
  const stage = lease?.renewalStage ?? 'NOT_STARTED';
  const notStarted = stage === 'NOT_STARTED';
  const scheduledAt = lease?.renewalScheduledAt ?? null;
  const scheduledInDays = scheduledAt ? daysUntil(scheduledAt) : 0;
  const followUpDue = scheduledAt ? new Date(scheduledAt).getTime() <= Date.now() : false;
  const overdueDays = scheduledAt ? Math.max(0, Math.floor((Date.now() - new Date(scheduledAt).getTime()) / 86_400_000)) : 0;

  const title = lease ? lease.tenant.name : 'Renewal';
  const subtitle = lease ? lease.property.name : '';
  const meta: WorkspaceMeta[] = lease ? [
    { label: 'Expires', value: `${days} ${days === 1 ? 'day' : 'days'}`, tone: days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : 'text-slate-200' },
    { label: 'Current rent', value: `${formatCurrency(lease.baseRent)}/mo` },
    { label: 'Revenue at risk', value: compactCurrency(lease.baseRent * 12), tone: 'text-warning' },
  ] : [];

  const recLine = notStarted
    ? 'Start the renewal conversation'
    : scheduledAt
    ? 'Follow-up is set — keep the renewal moving'
    : stage === 'CONTACTED'
    ? 'Schedule a follow-up to keep momentum'
    : 'Keep the renewal moving';

  const primary = notStarted
    ? { label: 'Start renewal', run: () => startRenewal.mutate(undefined, { onSuccess: handleClose }) }
    : { label: 'Mark contacted', run: () => markContacted.mutate(undefined, { onSuccess: handleClose }) };

  const secondary = [
    notStarted ? { label: 'Mark contacted', run: () => markContacted.mutate() } : null,
    { label: scheduledAt ? 'Reschedule follow-up' : 'Schedule follow-up', run: () => scheduleFollowUp.mutate() },
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
    <>
    <WorkspaceShell open={open} onClose={handleClose} eyebrow="Lease Renewal" title={title} subtitle={subtitle} meta={meta} footer={lease ? footer : undefined}>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : isError || !lease ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm font-medium text-fg">Couldn't load this renewal.</p>
          <p className="max-w-xs text-xs leading-relaxed text-slate-500">The lease may have been removed or reassigned. Open the lease to review it directly.</p>
          {leaseId && (
            <button type="button" onClick={openLease} className="text-sm font-medium text-brand-300 hover:text-brand-200">
              View lease →
            </button>
          )}
        </div>
      ) : (
        <>
          {scheduledAt && (
            <div className={`rounded-lg border px-4 py-3 ${followUpDue ? 'border-warning/30 bg-warning/[0.06]' : 'border-success/30 bg-success/[0.06]'}`}>
              <div className="flex items-center gap-2">
                <CalendarCheck className={`h-4 w-4 shrink-0 ${followUpDue ? 'text-warning' : 'text-success'}`} />
                <span className="text-sm font-semibold text-fg">{followUpDue ? 'Follow-up due' : 'Follow-up scheduled'}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(scheduledAt)}
                {followUpDue
                  ? overdueDays === 0 ? ' · due today — send the offer or reschedule.' : ` · ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue — send the offer or reschedule.`
                  : ` · in ${scheduledInDays} ${scheduledInDays === 1 ? 'day' : 'days'} — saved to this lease.`}
              </p>
            </div>
          )}

          <WorkspaceSection label="Renewal stage">
            <p className="text-sm font-medium text-slate-200">{titleCase(stage)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {lease.lastContactedAt ? `Last contacted ${formatDate(lease.lastContactedAt)}` : 'Not yet contacted'}
            </p>
          </WorkspaceSection>

          <WorkspaceSection label="Market rent">
            <p className="text-sm text-slate-400">Unavailable</p>
            <p className="mt-0.5 text-xs text-slate-500">Connect market data or enter it on the lease to compare.</p>
          </WorkspaceSection>

          <WorkspaceRecommendation lines={[recLine]} note={`Expires in ${days} ${days === 1 ? 'day' : 'days'} · ${compactCurrency(lease.baseRent * 12)} annual revenue at risk.`} />

          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/[0.06] px-4 py-2.5 text-sm font-semibold text-brand-300 transition-colors hover:bg-brand-500/10"
          >
            <Mail className="h-4 w-4" />
            Send renewal offer
          </button>

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
    {emailOpen && lease && (
      <EmailTenantModal
        tenantId={lease.tenantId}
        tenantName={lease.tenant.name}
        tenantEmail={lease.tenant.email}
        lease={{
          id: lease.id,
          propertyName: lease.property.name,
          unitNumber: lease.unitNumber,
          baseRent: lease.baseRent,
          endDate: lease.endDate,
        }}
        onClose={() => setEmailOpen(false)}
      />
    )}
    </>
  );
}
