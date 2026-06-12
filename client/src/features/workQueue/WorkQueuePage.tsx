import { useState } from 'react';
import { MorningBrief } from './MorningBrief';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  FileText,
  Building2,
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Clock,
  XCircle,
  User,
  ChevronDown,
  ChevronRight,
  Phone,
  TrendingUp,
} from 'lucide-react';
import { workQueueService, type WorkItem } from '@/services/workQueue.service';
import { TaskPanel } from './TaskPanel';
import { alertsService } from '@/services/alerts.service';
import { useAuthStore } from '@/state/auth.store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { OnboardingCard } from '@/features/onboarding/OnboardingCard';

const TYPE_LABEL: Record<string, string> = {
  LEASE_EXPIRATION: 'Lease Expiration',
  RENEWAL_RISK: 'Renewal Risk',
  PAYMENT_ANOMALY: 'Payment Anomaly',
  FINANCIAL_DISCREPANCY: 'Financial Discrepancy',
  OCCUPANCY_CHANGE: 'Occupancy Change',
  DATA_MISSING: 'Data Missing',
  COMPLIANCE_FLAG: 'Compliance',
  OVERDUE_INVOICE: 'Overdue Invoice',
};

function formatDollars(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

function SeverityIcon({ severity }: { severity: string }) {
  const cls =
    severity === 'CRITICAL'
      ? 'text-danger'
      : severity === 'WARNING'
      ? 'text-warning'
      : 'text-info';
  return <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${cls}`} />;
}

function ItemActions({
  item,
  busy,
  onProgress,
  onResolve,
  onDismiss,
}: {
  item: WorkItem;
  busy: boolean;
  onProgress: (id: string) => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();

  if (!item.alertId) {
    return (
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {item.source === 'finance' && item.property && (
          <Button variant="outline" size="sm" onClick={() => navigate('/finance')}>
            <DollarSign className="h-3.5 w-3.5" />
            Escalate to Collections
          </Button>
        )}
        {item.source === 'lease' && item.leaseId && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/leases/${item.leaseId}`)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Send Renewal Offer
          </Button>
        )}
      </div>
    );
  }

  const alertId = item.alertId;
  const actions: React.ReactNode[] = [];

  if (item.type === 'LEASE_EXPIRATION' && item.leaseId) {
    actions.push(
      <Button key="renew" variant="outline" size="sm" onClick={() => navigate(`/leases/${item.leaseId}`)}>
        <RefreshCw className="h-3.5 w-3.5" />
        Send Renewal Offer
      </Button>,
    );
  } else if (item.type === 'RENEWAL_RISK' && item.leaseId) {
    actions.push(
      <Button key="call" variant="outline" size="sm" onClick={() => navigate(`/leases/${item.leaseId}`)}>
        <Phone className="h-3.5 w-3.5" />
        Schedule Call
      </Button>,
    );
  } else if (item.type === 'PAYMENT_ANOMALY' || item.type === 'OVERDUE_INVOICE') {
    actions.push(
      <Button key="collections" variant="outline" size="sm" onClick={() => navigate('/finance')}>
        <DollarSign className="h-3.5 w-3.5" />
        Escalate to Collections
      </Button>,
    );
  } else if (item.type === 'FINANCIAL_DISCREPANCY') {
    actions.push(
      <Button key="finance" variant="outline" size="sm" onClick={() => navigate('/finance')}>
        <ClipboardList className="h-3.5 w-3.5" />
        Review Finance
      </Button>,
    );
  } else if (item.type === 'OCCUPANCY_CHANGE' && item.property) {
    actions.push(
      <Button key="pricing" variant="outline" size="sm" onClick={() => navigate(`/properties/${item.property!.id}`)}>
        <TrendingUp className="h-3.5 w-3.5" />
        Review Pricing Strategy
      </Button>,
    );
  } else {
    actions.push(
      <Button key="progress" variant="outline" size="sm" onClick={() => onProgress(alertId)} loading={busy}>
        Start Review
      </Button>,
    );
  }

  actions.push(
    <Button key="dismiss" variant="ghost" size="sm" onClick={() => onDismiss(alertId)} loading={busy}>
      <XCircle className="h-3.5 w-3.5" />
      Dismiss
    </Button>,
  );

  actions.push(
    <Button
      key="resolve"
      variant={item.severity === 'CRITICAL' ? 'danger' : 'outline'}
      size="sm"
      onClick={() => onResolve(alertId)}
      loading={busy}
    >
      <CheckCircle className="h-3.5 w-3.5" />
      Resolve
    </Button>,
  );

  return <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">{actions}</div>;
}

function WorkItemCard({
  item,
  busyId,
  onProgress,
  onResolve,
  onDismiss,
}: {
  item: WorkItem;
  busyId: string | null;
  onProgress: (id: string) => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const borderColor =
    item.severity === 'CRITICAL'
      ? 'border-l-danger/60'
      : item.severity === 'WARNING'
      ? 'border-l-warning/40'
      : 'border-l-info/30';

  const busy = busyId === item.alertId;

  return (
    <div className={`hover:bg-surface-200/30 transition-colors border-l-2 ${borderColor}`}>
    <div className="flex items-start gap-4 px-5 py-4">
      <SeverityIcon severity={item.severity} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-200">{item.title}</p>
          <Badge variant={item.severity === 'CRITICAL' ? 'danger' : item.severity === 'WARNING' ? 'warning' : 'info'}>
            {item.severity}
          </Badge>
          <Badge variant="neutral">{TYPE_LABEL[item.type] ?? item.type.replace(/_/g, ' ')}</Badge>
          {item.status === 'IN_PROGRESS' && <Badge variant="info">IN PROGRESS</Badge>}
        </div>

        <p className="mt-1 text-xs text-slate-500">{item.description}</p>

        {item.suggestedAction && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <ChevronRight className="h-3 w-3 text-brand-400/70 shrink-0 mt-0.5" />
            <p className="text-xs text-brand-300/80">{item.suggestedAction}</p>
          </div>
        )}

        <div className="mt-2 flex items-center gap-4 flex-wrap">
          {item.monthlyRisk > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-warning/80">
              <DollarSign className="h-3 w-3" />
              {formatDollars(item.monthlyRisk)}/mo at risk
            </span>
          )}
          {item.daysUntilExpiry !== null && (
            <span className={`flex items-center gap-1 text-xs font-medium ${
              item.daysUntilExpiry <= 30 ? 'text-danger' : item.daysUntilExpiry <= 60 ? 'text-warning' : 'text-slate-400'
            }`}>
              <Clock className="h-3 w-3" />
              {item.daysUntilExpiry}d until expiry
            </span>
          )}
          {item.property && <span className="text-xs text-slate-500">{item.property.name}</span>}
          {item.lease && <span className="text-xs text-slate-600">{item.lease.leaseNumber}</span>}
          {item.assignee && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <User className="h-3 w-3" />
              {item.assignee.firstName} {item.assignee.lastName}
            </span>
          )}
        </div>
      </div>

      <ItemActions
        item={item}
        busy={busy}
        onProgress={onProgress}
        onResolve={onResolve}
        onDismiss={onDismiss}
      />
    </div>

    <div className="px-5 pb-3">
      <TaskPanel alertId={item.alertId} leaseId={item.leaseId} />
    </div>
    </div>
  );
}

function SectionHeader({
  label,
  count,
  severity,
  collapsed,
  onToggle,
  right,
}: {
  label: string;
  count: number;
  severity: string;
  collapsed: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
}) {
  const color =
    severity === 'CRITICAL'
      ? 'text-danger'
      : severity === 'WARNING'
      ? 'text-warning'
      : severity === 'INFO'
      ? 'text-info'
      : 'text-slate-400';

  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 px-5 py-3 bg-surface-100/60 border-b border-surface-400/30 hover:bg-surface-100/80 transition-colors"
    >
      {collapsed
        ? <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        : <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
      <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
      <span className="text-xs text-slate-600">{count}</span>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </button>
  );
}

function SubHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-surface-50/30 border-b border-surface-400/20">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-xs text-slate-600">{count}</span>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="px-5 py-5 text-center">
      <p className="text-xs text-slate-600">{message}</p>
    </div>
  );
}

export default function WorkQueuePage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['work-queue', false],
    queryFn: () => workQueueService.getQueue(false),
  });

  const { data: myData } = useQuery({
    queryKey: ['work-queue', true],
    queryFn: () => workQueueService.getQueue(true),
  });

  const progressMutation = useMutation({
    mutationFn: (id: string) => { setBusyId(id); return alertsService.progress(id); },
    onSettled: () => setBusyId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-queue'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => { setBusyId(id); return alertsService.resolve(id); },
    onSettled: () => setBusyId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-queue'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => { setBusyId(id); return alertsService.dismiss(id); },
    onSettled: () => setBusyId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-queue'] }),
  });

  const handleProgress = (id: string) => progressMutation.mutate(id);
  const handleResolve = (id: string) => resolveMutation.mutate(id);
  const handleDismiss = (id: string) => dismissMutation.mutate(id);

  const toggle = (key: string) => setCollapsed((p) => ({ ...p, [key]: !p[key] }));

  // Section: Critical Today
  const critical = data?.items.filter((i) => i.severity === 'CRITICAL') ?? [];

  // Section: Assigned To Me
  const myItems = myData?.items ?? [];
  const myLeases = myItems.filter((i) => i.leaseId !== null);
  const myAlerts = myItems.filter((i) => i.alertId !== null && i.leaseId === null);

  // Section: Due This Week
  const dueThisWeek = data?.items.filter(
    (i) => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 7,
  ) ?? [];
  const renewalMeetings = dueThisWeek.filter((i) =>
    ['LEASE_EXPIRATION', 'RENEWAL_RISK'].includes(i.type),
  );
  const followUps = dueThisWeek.filter(
    (i) => !['LEASE_EXPIRATION', 'RENEWAL_RISK'].includes(i.type),
  );

  // Section: Other Items — WARNING/INFO items not shown in any other section
  const other = data?.items.filter(
    (i) =>
      i.severity !== 'CRITICAL' &&
      !(i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 7),
  ) ?? [];

  const totalRisk = data?.items.reduce((s, i) => s + i.monthlyRisk, 0) ?? 0;
  // "open" = items with OPEN status (excludes in-progress so the two counts don't overlap)
  const openCount = (data?.summary.total ?? 0) - (data?.summary.inProgress ?? 0);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const cardProps = { busyId, onProgress: handleProgress, onResolve: handleResolve, onDismiss: handleDismiss };

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <MorningBrief />
      <OnboardingCard />
      <PageHeader
        title="My Work"
        description={`${today}${data?.summary.total ? ` · ${data.summary.total} item${data.summary.total === 1 ? '' : 's'} need attention` : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {/* Stats bar */}
      {data?.summary && (
        <div className="flex flex-wrap gap-2">
          <StatChip value={openCount} label="open" />
          <StatChip value={data.summary.critical} label="critical" color="danger" />
          <StatChip value={data.summary.warning} label="warning" color="warning" />
          <StatChip value={data.summary.inProgress} label="in progress" color="brand" />
          {totalRisk > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-50 px-3 py-1.5">
              <DollarSign className="h-3.5 w-3.5 text-warning/60" />
              <span className="text-sm font-bold text-white tabular-nums">{formatDollars(totalRisk)}</span>
              <span className="text-xs text-slate-500">/mo at risk</span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="flex flex-col gap-4">
          {/* ─── Critical Today ─── */}
          <Card>
            <SectionHeader
              label="Critical Today"
              count={critical.length}
              severity="CRITICAL"
              collapsed={!!collapsed['critical']}
              onToggle={() => toggle('critical')}
            />
            {!collapsed['critical'] && (
              critical.length === 0 ? (
                <EmptySection message="No critical items — all clear." />
              ) : (
                <div className="divide-y divide-surface-400/30">
                  {critical.map((item) => (
                    <WorkItemCard key={item.id} item={item} {...cardProps} />
                  ))}
                </div>
              )
            )}
          </Card>

          {/* ─── Assigned To Me ─── */}
          <Card>
            <SectionHeader
              label="Assigned To Me"
              count={myItems.length}
              severity="INFO"
              collapsed={!!collapsed['assigned']}
              onToggle={() => toggle('assigned')}
              right={
                myItems.length > 0 ? (
                  <>
                    {myLeases.length > 0 && (
                      <Badge variant="neutral">
                        {myLeases.length} {myLeases.length === 1 ? 'lease' : 'leases'}
                      </Badge>
                    )}
                    {myAlerts.length > 0 && (
                      <Badge variant="neutral">
                        {myAlerts.length} {myAlerts.length === 1 ? 'alert' : 'alerts'}
                      </Badge>
                    )}
                  </>
                ) : undefined
              }
            />
            {!collapsed['assigned'] && (
              myItems.length === 0 ? (
                <EmptySection message={`Nothing assigned to ${user?.firstName ?? 'you'} right now.`} />
              ) : (
                <div className="divide-y divide-surface-400/30">
                  {myItems.map((item) => (
                    <WorkItemCard key={item.id} item={item} {...cardProps} />
                  ))}
                </div>
              )
            )}
          </Card>

          {/* ─── Due This Week ─── */}
          <Card>
            <SectionHeader
              label="Due This Week"
              count={dueThisWeek.length}
              severity="WARNING"
              collapsed={!!collapsed['week']}
              onToggle={() => toggle('week')}
            />
            {!collapsed['week'] && (
              dueThisWeek.length === 0 ? (
                <EmptySection message="Nothing expiring in the next 7 days." />
              ) : (
                <div className="divide-y divide-surface-400/30">
                  {renewalMeetings.length > 0 && (
                    <>
                      <SubHeader label="Renewal Meetings" count={renewalMeetings.length} />
                      {renewalMeetings.map((item) => (
                        <WorkItemCard key={item.id} item={item} {...cardProps} />
                      ))}
                    </>
                  )}
                  {followUps.length > 0 && (
                    <>
                      <SubHeader label="Follow-ups" count={followUps.length} />
                      {followUps.map((item) => (
                        <WorkItemCard key={item.id} item={item} {...cardProps} />
                      ))}
                    </>
                  )}
                </div>
              )
            )}
          </Card>

          {/* ─── Other Items (Warning / Info) ─── */}
          {other.length > 0 && (
            <Card>
              <SectionHeader
                label="Other Items"
                count={other.length}
                severity="NEUTRAL"
                collapsed={!!collapsed['other']}
                onToggle={() => toggle('other')}
              />
              {!!collapsed['other'] ? null : (
                <div className="divide-y divide-surface-400/30">
                  {other.map((item) => (
                    <WorkItemCard key={item.id} item={item} {...cardProps} />
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function StatChip({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: 'danger' | 'warning' | 'brand';
}) {
  const valueColor =
    color === 'danger'
      ? 'text-danger'
      : color === 'warning'
      ? 'text-warning'
      : color === 'brand'
      ? 'text-brand-400'
      : 'text-white';
  const borderColor =
    color === 'danger'
      ? 'border-danger/20 bg-danger/5'
      : color === 'warning'
      ? 'border-warning/20 bg-warning/5'
      : color === 'brand'
      ? 'border-brand-500/20 bg-brand-500/5'
      : 'border-surface-400/40 bg-surface-50';

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${borderColor}`}>
      <span className={`text-sm font-bold tabular-nums ${valueColor}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
