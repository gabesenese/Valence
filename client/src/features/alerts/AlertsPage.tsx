import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, Bell, FileText, Building2,
  RefreshCw, ClipboardList, ChevronDown, ChevronUp,
  User, Zap, XCircle,
} from 'lucide-react';
import { alertsService, type AlertActivity } from '@/services/alerts.service';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { formatRelative } from '@/utils/format';

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'info'> = {
  CRITICAL: 'danger',
  WARNING: 'warning',
  INFO: 'info',
};

const STATUS_TABS = [
  { label: 'Open', value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Dismissed', value: 'DISMISSED' },
  { label: 'All', value: '' },
];

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Alert created',
  SCAN_CREATED: 'Detected by anomaly scan',
  PROGRESSED: 'Marked in progress',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
  ASSIGNED: 'Assigned',
};

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
                  <summary className="cursor-pointer text-xs text-slate-600 hover:text-slate-400">
                    Why this was flagged
                  </summary>
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

function WorkflowActions({
  alert,
  onResolve,
  onDismiss,
  onProgress,
  onReopen,
  busy,
}: {
  alert: { id: string; type: string; severity: string; status: string; lease?: { id: string; leaseNumber: string } | null; property?: { id: string } | null };
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  onProgress: (id: string) => void;
  onReopen: (id: string) => void;
  busy: boolean;
}) {
  const navigate = useNavigate();
  const isOpen = alert.status === 'OPEN';
  const isInProgress = alert.status === 'IN_PROGRESS';

  if (!isOpen && !isInProgress) return null;

  const actions: React.ReactNode[] = [];

  if (isOpen) {
    actions.push(
      <Button key="progress" variant="outline" size="sm" onClick={() => onProgress(alert.id)} loading={busy}>
        Start Review
      </Button>
    );
  }

  if (isInProgress) {
    actions.push(
      <Button key="undo-progress" variant="ghost" size="sm" onClick={() => onReopen(alert.id)} loading={busy} title="Undo review — revert to open">
        ↩ Undo Review
      </Button>
    );
  }

  if (alert.type === 'LEASE_EXPIRATION' || alert.type === 'RENEWAL_RISK') {
    if (alert.lease) {
      actions.push(
        <Button key="view-lease" variant="ghost" size="sm" onClick={() => navigate(`/leases/${alert.lease!.id}`)}>
          <FileText className="h-3.5 w-3.5" />
          View Lease
        </Button>
      );
      actions.push(
        <Button key="renew" variant="outline" size="sm" onClick={() => navigate(`/leases/${alert.lease!.id}`)}>
          <RefreshCw className="h-3.5 w-3.5" />
          Start Renewal
        </Button>
      );
    }
  } else if (alert.type === 'PAYMENT_ANOMALY' || alert.type === 'FINANCIAL_DISCREPANCY') {
    actions.push(
      <Button key="review-finance" variant="ghost" size="sm" onClick={() => navigate('/finance')}>
        <ClipboardList className="h-3.5 w-3.5" />
        Review Finance
      </Button>
    );
    if (alert.property) {
      actions.push(
        <Button key="view-property" variant="outline" size="sm" onClick={() => navigate(`/properties/${alert.property!.id}`)}>
          <Building2 className="h-3.5 w-3.5" />
          View Property
        </Button>
      );
    }
  } else if (alert.type === 'OCCUPANCY_CHANGE') {
    if (alert.property) {
      actions.push(
        <Button key="view-property" variant="ghost" size="sm" onClick={() => navigate(`/properties/${alert.property!.id}`)}>
          <Building2 className="h-3.5 w-3.5" />
          View Property
        </Button>
      );
    }
    actions.push(
      <Button
        key="view-leases"
        variant="outline"
        size="sm"
        onClick={() => navigate(alert.property ? `/leases?propertyId=${alert.property.id}` : '/leases')}
      >
        <FileText className="h-3.5 w-3.5" />
        Review Leases
      </Button>
    );
  }

  actions.push(
    <Button key="dismiss" variant="ghost" size="sm" onClick={() => onDismiss(alert.id)} loading={busy}>
      <XCircle className="h-3.5 w-3.5" />
      Dismiss
    </Button>
  );

  actions.push(
    <Button
      key="resolve"
      variant={alert.severity === 'CRITICAL' ? 'danger' : 'outline'}
      size="sm"
      onClick={() => onResolve(alert.id)}
      loading={busy}
    >
      <CheckCircle className="h-3.5 w-3.5" />
      Resolve
    </Button>
  );

  return <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">{actions}</div>;
}

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [expandedActivity, setExpandedActivity] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: alertsService.getSummary,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', statusFilter],
    queryFn: () => alertsService.getAlerts({ status: statusFilter || undefined, limit: 50 }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => alertsService.resolve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => alertsService.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const progressMutation = useMutation({
    mutationFn: (id: string) => alertsService.progress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => alertsService.reopen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const scanMutation = useMutation({
    mutationFn: () => api.post('/alerts/scan'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  function toggleActivity(id: string) {
    setExpandedActivity((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const inProgressCount = summary?.byStatus.find((s) => s.status === 'IN_PROGRESS')?._count ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Alert Center</h1>
          <p className="mt-0.5 text-sm text-slate-500">Anomaly detection & operational risk monitoring</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => scanMutation.mutate()}
          loading={scanMutation.isPending}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Run Scan
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-danger tabular-nums">
              {summary.bySeverity.find(s => s.severity === 'CRITICAL')?._count ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Critical</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-warning tabular-nums">
              {summary.bySeverity.find(s => s.severity === 'WARNING')?._count ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Warning</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-400 tabular-nums">{inProgressCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">In Progress</p>
          </Card>
          <Card className="p-4 text-center">
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
              <div className="py-16 text-center">
                <CheckCircle className="mx-auto h-8 w-8 text-success/40" />
                <p className="mt-3 text-sm text-slate-500">No alerts in this category</p>
              </div>
            )}
            {data?.data.map((alert) => {
              const isExpanded = expandedActivity.has(alert.id);
              const isBusy =
                (resolveMutation.isPending && resolveMutation.variables === alert.id) ||
                (dismissMutation.isPending && dismissMutation.variables === alert.id) ||
                (progressMutation.isPending && progressMutation.variables === alert.id);

              return (
                <div key={alert.id}>
                  <div
                    className={`flex items-start gap-4 px-5 py-4 hover:bg-surface-200/30 transition-colors border-l-2 ${
                      alert.status === 'OPEN' && alert.severity === 'CRITICAL' ? 'border-l-danger/60' :
                      alert.status === 'OPEN' && alert.severity === 'WARNING' ? 'border-l-warning/40' :
                      alert.status === 'IN_PROGRESS' ? 'border-l-brand-500/50' :
                      'border-l-transparent'
                    }`}
                  >
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
                      alert.severity === 'CRITICAL' ? 'text-danger' :
                      alert.severity === 'WARNING' ? 'text-warning' : 'text-info'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-200">{alert.title}</p>
                        <Badge variant={SEVERITY_VARIANT[alert.severity] ?? 'neutral'}>{alert.severity}</Badge>
                        <Badge variant="neutral">{alert.type.replace(/_/g, ' ')}</Badge>
                        {alert.status === 'IN_PROGRESS' && (
                          <Badge variant="info">IN PROGRESS</Badge>
                        )}
                        {alert.status === 'RESOLVED' && (
                          <Badge variant="success">RESOLVED</Badge>
                        )}
                        {alert.status === 'DISMISSED' && (
                          <Badge variant="neutral">DISMISSED</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{alert.description}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                        {alert.property && <span>{alert.property.name}</span>}
                        {alert.lease && <span>Lease {alert.lease.leaseNumber}</span>}
                        {alert.assignee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {alert.assignee.firstName} {alert.assignee.lastName}
                          </span>
                        )}
                        <span>{formatRelative(alert.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <WorkflowActions
                        alert={alert}
                        onResolve={(id) => resolveMutation.mutate(id)}
                        onDismiss={(id) => dismissMutation.mutate(id)}
                        onProgress={(id) => progressMutation.mutate(id)}
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
    </div>
  );
}
