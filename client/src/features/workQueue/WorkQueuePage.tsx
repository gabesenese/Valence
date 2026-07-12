import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  ClipboardList,
  RefreshCw,
  DollarSign,
  Clock,
  XCircle,
  ChevronDown,
  ChevronRight,
  Phone,
  TrendingUp,
} from 'lucide-react';
import { workQueueService, type WorkItem } from '@/services/workQueue.service';
import { alertDestination, type AlertDestination } from '@/features/alerts/alertDestination';
import { withFocus } from '@/lib/focusSection';
import { TaskPanel } from './TaskPanel';
import { alertsService } from '@/services/alerts.service';
import { analyticsService } from '@/services/analytics.service';
import { ActivationPrompt } from '@/features/onboarding/ActivationPrompt';
import { useAuthStore } from '@/state/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';


function formatDollars(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

function AnimatedItem({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: index * 0.055 }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedCollapse({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function workItemDestination(item: WorkItem): AlertDestination | null {
  if (item.alertId) {
    return alertDestination({
      type: item.type,
      propertyId: item.property?.id ?? undefined,
      leaseId: item.leaseId ?? item.lease?.id ?? undefined,
      property: item.property ?? undefined,
      lease: item.lease ?? undefined,
    });
  }
  const leaseId = item.leaseId ?? item.lease?.id;
  if (item.source === 'lease' && leaseId) return { to: withFocus(`/leases/${leaseId}`, 'renewal'), label: 'Review renewal' };
  if (item.source === 'finance') return { to: withFocus('/finance?tab=ledger', 'transaction'), label: 'Review ledger' };
  return null;
}

function primaryActionMeta(item: WorkItem): { label: string; Icon: typeof RefreshCw } {
  if (!item.alertId) {
    return item.source === 'finance'
      ? { label: 'Escalate to Collections', Icon: DollarSign }
      : { label: 'Send Renewal Offer', Icon: RefreshCw };
  }
  switch (item.type) {
    case 'LEASE_EXPIRATION':      return { label: 'Send Renewal Offer', Icon: RefreshCw };
    case 'RENEWAL_RISK':          return { label: 'Schedule Call', Icon: Phone };
    case 'PAYMENT_ANOMALY':
    case 'OVERDUE_INVOICE':       return { label: 'Escalate to Collections', Icon: DollarSign };
    case 'FINANCIAL_DISCREPANCY': return { label: 'Review Finance', Icon: ClipboardList };
    case 'OCCUPANCY_CHANGE':      return { label: 'Review Pricing', Icon: TrendingUp };
    default:                      return { label: 'Review', Icon: ClipboardList };
  }
}

function itemActions(
  item: WorkItem,
  busy: boolean,
  onProgress: (id: string) => void,
  onResolve: (id: string) => void,
  onDismiss: (id: string) => void,
  navigate: ReturnType<typeof useNavigate>,
): React.ReactNode[] {
  const alertId = item.alertId;
  const dest = workItemDestination(item);
  const { label, Icon } = primaryActionMeta(item);
  const actions: React.ReactNode[] = [];

  if (dest) {
    actions.push(
      <Button key="primary" variant="outline" size="sm" onClick={() => navigate(dest.to)}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </Button>,
    );
  } else if (alertId) {
    actions.push(
      <Button key="progress" variant="outline" size="sm" onClick={() => onProgress(alertId)} loading={busy}>
        Start Review
      </Button>,
    );
  }

  if (!alertId) return actions;

  actions.push(
    <Button key="dismiss" variant="ghost" size="sm" onClick={() => onDismiss(alertId)} loading={busy}>
      <XCircle className="h-3.5 w-3.5" /> Dismiss
    </Button>,
  );
  actions.push(
    <Button
      key="resolve"
      variant="success"
      size="sm"
      onClick={() => onResolve(alertId)}
      loading={busy}
    >
      <CheckCircle className="h-3.5 w-3.5" /> Resolve
    </Button>,
  );

  return actions;
}

function QueueHero({
  user,
  summary,
  topItem,
  totalRisk,
  isFetching,
  onRefresh,
}: {
  user: { firstName?: string | null } | null;
  summary: { total: number; critical: number; warning: number; inProgress: number } | undefined;
  topItem: WorkItem | undefined;
  totalRisk: number;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const allClear = !summary || summary.total === 0;

  return (
    <div className="rounded-2xl border border-surface-400/30 bg-surface-100 overflow-hidden">
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600">{today}</p>
            <h1 className="mt-1 text-xl font-bold text-fg">{greeting}, {user?.firstName}.</h1>

            {allClear ? (
              <p className="mt-3 text-sm text-success">All clear — no items requiring attention.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">
                {(summary?.critical ?? 0) > 0 && (
                  <p className="text-sm text-slate-300 leading-relaxed">
                    <span className="font-semibold text-danger">{summary!.critical} critical item{summary!.critical !== 1 ? 's' : ''}</span>
                    {' '}require{summary!.critical === 1 ? 's' : ''} attention.
                  </p>
                )}
                {(summary?.warning ?? 0) > 0 && (summary?.critical ?? 0) === 0 && (
                  <p className="text-sm text-slate-300 leading-relaxed">
                    <span className="font-semibold text-warning">{summary!.warning} warning{summary!.warning !== 1 ? 's' : ''}</span>
                    {' '}require{summary!.warning === 1 ? 's' : ''} attention.
                  </p>
                )}
                {totalRisk > 0 && (
                  <p className="text-sm text-slate-300 leading-relaxed">
                    <span className="font-semibold text-fg">{formatDollars(totalRisk)}/month</span>
                    {' '}revenue is currently at risk.
                  </p>
                )}
                {topItem && (
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Most urgent: <span className="font-medium text-slate-200">{topItem.title}.</span>
                    {topItem.monthlyRisk > 0 && (
                      <span className="text-warning"> {formatDollars(topItem.monthlyRisk)}/month exposure.</span>
                    )}
                  </p>
                )}
                {(summary?.total ?? 0) > 0 && (
                  <p className="text-xs text-slate-600">{summary!.total} item{summary!.total !== 1 ? 's' : ''} need attention.</p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-surface-400/30 bg-surface-200/50 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

      </div>
    </div>
  );
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
  const navigate = useNavigate();
  const busy = busyId === item.alertId;

  const actions = itemActions(item, busy, onProgress, onResolve, onDismiss, navigate);

  const card = (
    <div className="hover:bg-surface-200/30 transition-colors">
      <div className="px-4 py-4 flex flex-col gap-1.5 sm:px-5">
        {item.monthlyRisk > 0 && (
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tabular-nums text-warning">{formatDollars(item.monthlyRisk)}</span>
            <span className="text-xs text-slate-500">/mo at risk</span>
          </div>
        )}

        <p className="text-sm font-medium text-slate-200 leading-snug">
          {item.title}
          {item.status === 'IN_PROGRESS' && (
            <span className="ml-2 inline-flex items-center rounded-full border border-brand-500/20 bg-brand-600/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-400">In Progress</span>
          )}
        </p>

        {item.suggestedAction && (
          <p className="flex items-center gap-1 text-xs text-brand-300/80">
            <ChevronRight className="h-3 w-3 shrink-0" />
            {item.suggestedAction}
          </p>
        )}

        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 mt-0.5">
          {item.property && <span>{item.property.name}</span>}
          {item.daysUntilExpiry !== null && (
            <span className={`flex items-center gap-0.5 font-medium ${
              item.daysUntilExpiry <= 30 ? 'text-danger' : item.daysUntilExpiry <= 60 ? 'text-warning' : 'text-slate-400'
            }`}>
              <Clock className="h-3 w-3" />
              {item.daysUntilExpiry}d left
            </span>
          )}
        </div>

        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {actions}
          </div>
        )}
      </div>

      <div className="px-5 pb-3">
        <TaskPanel alertId={item.alertId} leaseId={item.leaseId} />
      </div>
    </div>
  );

  return card;
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

  const { data: summary } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: analyticsService.getSummary,
    staleTime: 60_000,
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    critical: false,
    assigned: true,
    week:     true,
    other:    true,
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['work-queue', false],
    queryFn: () => workQueueService.getQueue(false),
  });

  const { data: myData, isFetching: myIsFetching } = useQuery({
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

  const critical = data?.items.filter((i) => i.severity === 'CRITICAL') ?? [];

  const myItems = myData?.items ?? [];
  const myLeases = myItems.filter((i) => i.leaseId !== null);
  const myAlerts = myItems.filter((i) => i.alertId !== null && i.leaseId === null);

  const dueThisWeek = data?.items.filter(
    (i) => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 7,
  ) ?? [];
  const renewalMeetings = dueThisWeek.filter((i) =>
    ['LEASE_EXPIRATION', 'RENEWAL_RISK'].includes(i.type),
  );
  const followUps = dueThisWeek.filter(
    (i) => !['LEASE_EXPIRATION', 'RENEWAL_RISK'].includes(i.type),
  );

  const other = data?.items.filter(
    (i) =>
      i.severity !== 'CRITICAL' &&
      !(i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 7),
  ) ?? [];

  const totalRisk = data?.items.reduce((s, i) => s + i.monthlyRisk, 0) ?? 0;
  const topItem = critical[0];

  const cardProps = { busyId, onProgress: handleProgress, onResolve: handleResolve, onDismiss: handleDismiss };

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:gap-6 sm:p-6">
      {summary && (
        <ActivationPrompt
          hasProperties={summary.properties.total > 0}
          hasLeases={summary.leases.active > 0}
        />
      )}

      <QueueHero
        user={user}
        summary={data?.summary}
        topItem={topItem}
        totalRisk={totalRisk}
        isFetching={isFetching || myIsFetching}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['work-queue'] })}
      />

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden">
            <SectionHeader
              label="Critical Today"
              count={critical.length}
              severity="CRITICAL"
              collapsed={!!collapsed['critical']}
              onToggle={() => toggle('critical')}
            />
            <AnimatedCollapse show={!collapsed['critical']}>
              {critical.length === 0 ? (
                <EmptySection message="No critical items — all clear." />
              ) : (
                <div className="divide-y divide-surface-400/30">
                  {critical.map((item, i) => (
                    <AnimatedItem key={item.id} index={i}>
                      <WorkItemCard item={item} {...cardProps} />
                    </AnimatedItem>
                  ))}
                </div>
              )}
            </AnimatedCollapse>
          </Card>

          <Card className="overflow-hidden">
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
            <AnimatedCollapse show={!collapsed['assigned']}>
              {myItems.length === 0 ? (
                <EmptySection message={`Nothing assigned to ${user?.firstName ?? 'you'} right now.`} />
              ) : (
                <div className="divide-y divide-surface-400/30">
                  {myItems.map((item, i) => (
                    <AnimatedItem key={item.id} index={i}>
                      <WorkItemCard item={item} {...cardProps} />
                    </AnimatedItem>
                  ))}
                </div>
              )}
            </AnimatedCollapse>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader
              label="Due This Week"
              count={dueThisWeek.length}
              severity="WARNING"
              collapsed={!!collapsed['week']}
              onToggle={() => toggle('week')}
            />
            <AnimatedCollapse show={!collapsed['week']}>
              {dueThisWeek.length === 0 ? (
                <EmptySection message="Nothing expiring in the next 7 days." />
              ) : (
                <div className="divide-y divide-surface-400/30">
                  {renewalMeetings.length > 0 && (
                    <>
                      <SubHeader label="Renewal Meetings" count={renewalMeetings.length} />
                      {renewalMeetings.map((item, i) => (
                        <AnimatedItem key={item.id} index={i}>
                          <WorkItemCard item={item} {...cardProps} />
                        </AnimatedItem>
                      ))}
                    </>
                  )}
                  {followUps.length > 0 && (
                    <>
                      <SubHeader label="Follow-ups" count={followUps.length} />
                      {followUps.map((item, i) => (
                        <AnimatedItem key={item.id} index={i}>
                          <WorkItemCard item={item} {...cardProps} />
                        </AnimatedItem>
                      ))}
                    </>
                  )}
                </div>
              )}
            </AnimatedCollapse>
          </Card>

          {other.length > 0 && (
            <Card className="overflow-hidden">
              <SectionHeader
                label="Other Items"
                count={other.length}
                severity="NEUTRAL"
                collapsed={!!collapsed['other']}
                onToggle={() => toggle('other')}
              />
              <AnimatedCollapse show={!collapsed['other']}>
                <div className="divide-y divide-surface-400/30">
                  {other.map((item, i) => (
                    <AnimatedItem key={item.id} index={i}>
                      <WorkItemCard item={item} {...cardProps} />
                    </AnimatedItem>
                  ))}
                </div>
              </AnimatedCollapse>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

