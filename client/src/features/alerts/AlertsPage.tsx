import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Bell, FileText, Building2,
  RefreshCw, ClipboardList, ChevronDown, ChevronUp,
  User, Zap, XCircle, Check, Play, RotateCcw,
} from 'lucide-react';
import { alertsService, type Alert, type AlertActivity } from '@/services/alerts.service';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatRelative } from '@/utils/format';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'info'> = {
  CRITICAL: 'danger', WARNING: 'warning', INFO: 'info',
};

const STATUS_TABS = [
  { label: 'Open',         value: 'OPEN' },
  { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
  { label: 'In Progress',  value: 'IN_PROGRESS' },
  { label: 'Resolved',     value: 'RESOLVED' },
  { label: 'Dismissed',    value: 'DISMISSED' },
  { label: 'All',          value: '' },
];

const ACTION_LABELS: Record<string, string> = {
  CREATED:      'Alert created',
  SCAN_CREATED: 'Detected by anomaly scan',
  ACKNOWLEDGED: 'Acknowledged',
  PROGRESSED:   'Moved to in progress',
  RESOLVED:     'Resolved',
  DISMISSED:    'Dismissed',
  ASSIGNED:     'Assigned',
  REOPENED:     'Reopened',
};

// ─── Activity timeline ────────────────────────────────────────────────────────

function ActivityTimeline({ alertId }: { alertId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['alerts', alertId, 'activity'],
    queryFn: () => alertsService.getActivity(alertId),
  });

  if (isLoading) return <div className="px-5 py-3 text-xs text-slate-500">Loading activity…</div>;
  if (!data || data.length === 0) return <div className="px-5 py-3 text-xs text-slate-500">No activity recorded.</div>;

  return (
    <div className="px-5 py-3 border-t border-surface-400/30 bg-surface-200/20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Activity</p>
      <ol className="relative border-l border-surface-400/40 ml-2 space-y-3">
        {data.map((entry: AlertActivity) => {
          const label = ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, ' ').toLowerCase();
          const actor = entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : 'System';
          const meta = entry.metadata as Record<string, unknown> | null | undefined;
          return (
            <li key={entry.id} className="ml-4">
              <div className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-surface-500 border border-surface-400" />
              <p className="text-xs font-medium text-slate-300">{label}</p>
              <p className="text-xs text-slate-500">
                {actor} · {formatRelative(entry.createdAt)}
              </p>
              {!!meta?.note && (
                <p className="mt-0.5 text-xs italic text-slate-500">"{String(meta.note)}"</p>
              )}
              {entry.action === 'SCAN_CREATED' && !!meta?.explanation && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-slate-600 hover:text-slate-400">Why this was flagged</summary>
                  <pre className="mt-1 text-[10px] text-slate-500 whitespace-pre-wrap">
                    {JSON.stringify(meta.explanation, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Notes modal ──────────────────────────────────────────────────────────────

function NotesModal({
  action,
  busy,
  onConfirm,
  onCancel,
}: {
  action: 'resolve' | 'dismiss';
  busy: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-surface-400/60 bg-surface-100 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white">
          {action === 'resolve' ? 'Resolve alert' : 'Dismiss alert'}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {action === 'resolve'
            ? 'Document what was done to resolve this alert.'
            : 'Optionally explain why this alert is being dismissed.'}
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)…"
          className="mt-4 w-full rounded-lg border border-surface-400/60 bg-surface-200 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 resize-none"
          rows={3}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            variant={action === 'resolve' ? 'primary' : 'danger'}
            onClick={() => onConfirm(note)}
            loading={busy}
          >
            {action === 'resolve' ? 'Resolve' : 'Dismiss'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow actions ─────────────────────────────────────────────────────────

function WorkflowActions({
  alert,
  onAcknowledge,
  onProgress,
  onResolve,
  onDismiss,
  onReopen,
  busy,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onProgress: (id: string) => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  onReopen: (id: string) => void;
  busy: boolean;
}) {
  const navigate = useNavigate();
  const { status } = alert;

  // Context links (navigate to related entity)
  const contextLinks: React.ReactNode[] = [];
  if (alert.type === 'LEASE_EXPIRATION' || alert.type === 'RENEWAL_RISK') {
    if (alert.lease) {
      contextLinks.push(
        <Button key="view-lease" variant="ghost" size="sm" onClick={() => navigate(`/leases/${alert.lease!.id}`)}>
          <FileText className="h-3.5 w-3.5" /> View Lease
        </Button>
      );
    }
  } else if (alert.type === 'PAYMENT_ANOMALY' || alert.type === 'FINANCIAL_DISCREPANCY') {
    contextLinks.push(
      <Button key="finance" variant="ghost" size="sm" onClick={() => navigate('/finance')}>
        <ClipboardList className="h-3.5 w-3.5" /> Finance
      </Button>
    );
  }
  if (alert.property && alert.type !== 'LEASE_EXPIRATION' && alert.type !== 'RENEWAL_RISK') {
    contextLinks.push(
      <Button key="property" variant="ghost" size="sm" onClick={() => navigate(`/properties/${alert.property!.id}`)}>
        <Building2 className="h-3.5 w-3.5" /> Property
      </Button>
    );
  }

  if (status === 'RESOLVED' || status === 'DISMISSED' || status === 'SUPPRESSED') {
    return (
      <Button variant="ghost" size="sm" onClick={() => onReopen(alert.id)} loading={busy}>
        <RotateCcw className="h-3.5 w-3.5" /> Reopen
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {/* Context navigation */}
      {contextLinks}

      {/* Undo */}
      {(status === 'ACKNOWLEDGED' || status === 'IN_PROGRESS') && (
        <Button variant="ghost" size="sm" onClick={() => onReopen(alert.id)} loading={busy} title="Revert to Open">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* State transitions */}
      {status === 'OPEN' && (
        <Button variant="outline" size="sm" onClick={() => onAcknowledge(alert.id)} loading={busy}>
          <Check className="h-3.5 w-3.5" /> Acknowledge
        </Button>
      )}

      {status === 'ACKNOWLEDGED' && (
        <Button variant="outline" size="sm" onClick={() => onProgress(alert.id)} loading={busy}>
          <Play className="h-3.5 w-3.5" /> Start Work
        </Button>
      )}

      {(status === 'OPEN' || status === 'ACKNOWLEDGED' || status === 'IN_PROGRESS') && (
        <>
          <Button variant="ghost" size="sm" onClick={() => onDismiss(alert.id)} loading={busy}>
            <XCircle className="h-3.5 w-3.5" /> Dismiss
          </Button>
          <Button
            variant={alert.severity === 'CRITICAL' ? 'danger' : 'outline'}
            size="sm"
            onClick={() => onResolve(alert.id)}
            loading={busy}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Accountability line ──────────────────────────────────────────────────────

function AccountabilityLine({ alert }: { alert: Alert }) {
  const { status, acknowledgedByUser, acknowledgedAt, resolvedByUser, resolvedAt, dismissedByUser, dismissedAt } = alert;

  const name = (u: { firstName: string; lastName: string } | null | undefined) =>
    u ? `${u.firstName} ${u.lastName}` : null;

  if (status === 'ACKNOWLEDGED' && acknowledgedByUser) {
    return (
      <p className="mt-1 text-xs text-amber-400/70">
        Acknowledged by {name(acknowledgedByUser)}{acknowledgedAt ? ` · ${formatRelative(acknowledgedAt)}` : ''}
      </p>
    );
  }
  if (status === 'IN_PROGRESS' && acknowledgedByUser) {
    return (
      <p className="mt-1 text-xs text-brand-400/70">
        Acknowledged by {name(acknowledgedByUser)}{acknowledgedAt ? ` · ${formatRelative(acknowledgedAt)}` : ''}
      </p>
    );
  }
  if (status === 'RESOLVED') {
    const who = name(resolvedByUser);
    return (
      <p className="mt-1 text-xs text-success/60">
        Resolved{who ? ` by ${who}` : ''}{resolvedAt ? ` · ${formatRelative(resolvedAt)}` : ''}
        {alert.resolutionNote && <span className="ml-1 italic text-slate-500">— "{alert.resolutionNote}"</span>}
      </p>
    );
  }
  if (status === 'DISMISSED') {
    const who = name(dismissedByUser);
    return (
      <p className="mt-1 text-xs text-slate-500">
        Dismissed{who ? ` by ${who}` : ''}{dismissedAt ? ` · ${formatRelative(dismissedAt)}` : ''}
        {alert.resolutionNote && <span className="ml-1 italic">— "{alert.resolutionNote}"</span>}
      </p>
    );
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [expandedActivity, setExpandedActivity] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'resolve' | 'dismiss' } | null>(null);
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: alertsService.getSummary,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', statusFilter],
    queryFn: () => alertsService.getAlerts({ status: statusFilter || undefined, limit: 50 }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['alerts'] });

  const acknowledgeMutation = useMutation({ mutationFn: (id: string) => alertsService.acknowledge(id), onSuccess: invalidate });
  const progressMutation    = useMutation({ mutationFn: (id: string) => alertsService.progress(id),    onSuccess: invalidate });
  const reopenMutation      = useMutation({ mutationFn: (id: string) => alertsService.reopen(id),      onSuccess: invalidate });
  const scanMutation        = useMutation({ mutationFn: () => api.post('/alerts/scan'),                 onSuccess: invalidate });

  const resolveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => alertsService.resolve(id, note),
    onSuccess: () => { invalidate(); setPendingAction(null); },
  });
  const dismissMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => alertsService.dismiss(id, note),
    onSuccess: () => { invalidate(); setPendingAction(null); },
  });

  function toggleActivity(id: string) {
    setExpandedActivity((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const inProgressCount    = summary?.byStatus.find((s) => s.status === 'IN_PROGRESS')?._count ?? 0;
  const acknowledgedCount  = summary?.acknowledgedTotal ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Alert Center"
        description="Operational risk tracking with full accountability"
        actions={
          <Button variant="outline" size="sm" onClick={() => scanMutation.mutate()} loading={scanMutation.isPending}>
            <RefreshCw className="h-3.5 w-3.5" /> Run Scan
          </Button>
        }
      />

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4 text-center cursor-pointer" hover onClick={() => setStatusFilter('OPEN')}>
            <p className="text-2xl font-bold text-danger tabular-nums">
              {summary.bySeverity.find((s) => s.severity === 'CRITICAL')?._count ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Critical Open</p>
          </Card>
          <Card className="p-4 text-center cursor-pointer" hover onClick={() => setStatusFilter('ACKNOWLEDGED')}>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{acknowledgedCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">Acknowledged</p>
          </Card>
          <Card className="p-4 text-center cursor-pointer" hover onClick={() => setStatusFilter('IN_PROGRESS')}>
            <p className="text-2xl font-bold text-brand-400 tabular-nums">{inProgressCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">In Progress</p>
          </Card>
          <Card className="p-4 text-center cursor-pointer" hover onClick={() => setStatusFilter('OPEN')}>
            <p className="text-2xl font-bold text-white tabular-nums">{summary.openTotal}</p>
            <p className="mt-0.5 text-xs text-slate-500">Total Open</p>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40'
                : 'text-slate-500 border border-transparent hover:border-surface-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
            {tab.value === 'ACKNOWLEDGED' && acknowledgedCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 tabular-nums">
                {acknowledgedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <Bell className="h-4 w-4 text-slate-600" />
        </CardHeader>
        {isLoading ? <PageLoader /> : (
          <div className="divide-y divide-surface-400/30">
            {data?.data.length === 0 && (
              <EmptyState icon={CheckCircle2} title="No alerts in this category" />
            )}
            {data?.data.map((alert) => {
              const isExpanded = expandedActivity.has(alert.id);
              const isBusy =
                (acknowledgeMutation.isPending && acknowledgeMutation.variables === alert.id) ||
                (progressMutation.isPending    && progressMutation.variables    === alert.id) ||
                (reopenMutation.isPending      && reopenMutation.variables      === alert.id) ||
                (resolveMutation.isPending     && resolveMutation.variables?.id === alert.id) ||
                (dismissMutation.isPending     && dismissMutation.variables?.id === alert.id);

              const borderClass =
                alert.status === 'OPEN' && alert.severity === 'CRITICAL' ? 'border-l-danger/60' :
                alert.status === 'OPEN' && alert.severity === 'WARNING'  ? 'border-l-warning/40' :
                alert.status === 'ACKNOWLEDGED'                           ? 'border-l-amber-400/50' :
                alert.status === 'IN_PROGRESS'                           ? 'border-l-brand-500/50' :
                'border-l-transparent';

              return (
                <div key={alert.id}>
                  <div className={`flex items-start gap-4 px-5 py-4 hover:bg-surface-200/30 transition-colors border-l-2 ${borderClass}`}>
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
                      alert.severity === 'CRITICAL' ? 'text-danger' :
                      alert.severity === 'WARNING'  ? 'text-warning' : 'text-info'
                    }`} />

                    <div className="min-w-0 flex-1">
                      {/* Title + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-200">{alert.title}</p>
                        <Badge variant={SEVERITY_VARIANT[alert.severity] ?? 'neutral'}>{alert.severity}</Badge>
                        <Badge variant="neutral">{alert.type.replace(/_/g, ' ')}</Badge>
                        {alert.status === 'ACKNOWLEDGED' && <Badge variant="warning">ACKNOWLEDGED</Badge>}
                        {alert.status === 'IN_PROGRESS'  && <Badge variant="info">IN PROGRESS</Badge>}
                        {alert.status === 'RESOLVED'     && <Badge variant="success">RESOLVED</Badge>}
                        {alert.status === 'DISMISSED'    && <Badge variant="neutral">DISMISSED</Badge>}
                      </div>

                      {/* Description */}
                      <p className="mt-1 text-xs text-slate-500">{alert.description}</p>

                      {/* Meta row */}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        {alert.property && <span>{alert.property.name}</span>}
                        {alert.lease    && <span>Lease {alert.lease.leaseNumber}</span>}
                        {alert.assignee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {alert.assignee.firstName} {alert.assignee.lastName}
                          </span>
                        )}
                        <span>{formatRelative(alert.createdAt)}</span>
                      </div>

                      {/* Accountability */}
                      <AccountabilityLine alert={alert} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <WorkflowActions
                        alert={alert}
                        onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                        onProgress={(id) => progressMutation.mutate(id)}
                        onResolve={(id) => setPendingAction({ id, action: 'resolve' })}
                        onDismiss={(id) => setPendingAction({ id, action: 'dismiss' })}
                        onReopen={(id) => reopenMutation.mutate(id)}
                        busy={isBusy}
                      />
                      <button
                        onClick={() => toggleActivity(alert.id)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-300 hover:bg-surface-300/40 transition-colors"
                        title="Show activity"
                      >
                        <Zap className="h-3 w-3" />
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && <ActivityTimeline alertId={alert.id} />}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Notes modal */}
      {pendingAction && (
        <NotesModal
          action={pendingAction.action}
          busy={resolveMutation.isPending || dismissMutation.isPending}
          onConfirm={(note) => {
            if (pendingAction.action === 'resolve') {
              resolveMutation.mutate({ id: pendingAction.id, note: note || undefined });
            } else {
              dismissMutation.mutate({ id: pendingAction.id, note: note || undefined });
            }
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
