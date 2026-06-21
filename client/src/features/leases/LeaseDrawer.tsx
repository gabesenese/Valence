import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X, ExternalLink, AlertTriangle,
  User, RefreshCw, Phone, BellOff, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { leasesService, type RenewalStage } from '@/services/leases.service';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { formatCurrency, formatDate, daysUntil } from '@/utils/format';
import { useChartColors } from '@/hooks/useChartColors';

const STAGE_LABEL: Record<RenewalStage, string> = {
  NOT_STARTED: 'Not started',
  CONTACTED: 'Contacted',
  NEGOTIATING: 'Negotiating',
  DRAFT_SENT: 'Draft sent',
  LEGAL_REVIEW: 'Legal review',
  SCHEDULED_RENEWAL: 'Scheduled',
  SIGNED: 'Signed',
};

const STAGE_VARIANT: Record<RenewalStage, 'neutral' | 'info' | 'warning' | 'brand' | 'success'> = {
  NOT_STARTED: 'neutral',
  CONTACTED: 'info',
  NEGOTIATING: 'warning',
  DRAFT_SENT: 'brand',
  LEGAL_REVIEW: 'warning',
  SCHEDULED_RENEWAL: 'brand',
  SIGNED: 'success',
};

const RISK_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-danger border-l-danger/60',
  WARNING: 'text-warning border-l-warning/40',
  INFO: 'text-info border-l-info/30',
};

interface Props {
  leaseId: string | null;
  onClose: () => void;
}

export default function LeaseDrawer({ leaseId, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const c = useChartColors();
  const { data, isLoading } = useQuery({
    queryKey: ['leases', leaseId, 'preview'],
    queryFn: () => leasesService.getPreview(leaseId!),
    enabled: !!leaseId,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['leases'] });
  }, [qc]);

  const startRenewal = useMutation({
    mutationFn: (id: string) => leasesService.startRenewal(id),
    onSuccess: invalidate,
  });
  const markContacted = useMutation({
    mutationFn: (id: string) => leasesService.markContacted(id),
    onSuccess: invalidate,
  });
  const snooze = useMutation({
    mutationFn: (id: string) => leasesService.snooze(id),
    onSuccess: invalidate,
  });

  const setRenewalDate = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      leasesService.setRenewalDateAction(id, date),
    onSuccess: invalidate,
  });

  const clearRenewalDate = useMutation({
    mutationFn: (id: string) => leasesService.clearRenewalDate(id),
    onSuccess: invalidate,
  });

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const open = !!leaseId;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col border-l border-surface-400/60 bg-surface-100 shadow-2xl transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-surface-400/40 px-5 py-4 shrink-0">
          {data ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-fg">{data.lease.leaseNumber}</span>
                <Badge variant={RISK_VARIANT[data.lease.renewalRisk] ?? 'neutral'} dot>
                  {data.lease.renewalRisk}
                </Badge>
                <Badge variant={STAGE_VARIANT[data.lease.renewalStage]}>
                  {STAGE_LABEL[data.lease.renewalStage]}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {data.lease.tenant.name} · {data.lease.property.name}
              </p>
            </div>
          ) : (
            <div className="h-5 w-40 animate-pulse rounded bg-surface-400" />
          )}
          <button onClick={onClose} className="ml-3 shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-surface-300 hover:text-fg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-4 p-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-300" />
              ))}
            </div>
          ) : data ? (
            <>
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-400/30">
                <DaysRemaining endDate={data.lease.endDate} />
                {data.priorityScore > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Priority</p>
                    <p className="text-sm font-semibold text-warning tabular-nums">{data.priorityScore}</p>
                    <p className="text-xs text-slate-600 max-w-[180px] text-right">{data.whyThisIsHere}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-px bg-surface-400/30 border-b border-surface-400/30">
                <Stat label="Monthly rent" value={formatCurrency(Number(data.lease.baseRent))} />
                <Stat label="Annual rent" value={formatCurrency(Number(data.lease.baseRent) * 12)} />
                <Stat label="Start date" value={formatDate(data.lease.startDate)} />
                <Stat label="End date" value={formatDate(data.lease.endDate)} danger={daysUntil(data.lease.endDate) <= 60} />
              </div>

              <Section title="Renewal">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Stage</span>
                  <Badge variant={STAGE_VARIANT[data.lease.renewalStage]}>
                    {STAGE_LABEL[data.lease.renewalStage]}
                  </Badge>
                </div>
                <DatePicker
                  value={data.lease.renewalDate?.slice(0, 10) ?? ''}
                  onChange={(date) => setRenewalDate.mutate({ id: data.lease.id, date })}
                  onClear={data.lease.renewalDate ? () => clearRenewalDate.mutate(data.lease.id) : undefined}
                  disabled={setRenewalDate.isPending || clearRenewalDate.isPending}
                  placeholder="Set renewal date"
                  className="mt-2"
                />
                {data.lease.lastContactedAt && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500">Last contacted</span>
                    <span className="text-xs text-slate-400">{formatDate(data.lease.lastContactedAt)}</span>
                  </div>
                )}
                {data.lease.owner && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Owner
                    </span>
                    <span className="text-xs text-slate-300">
                      {data.lease.owner.firstName} {data.lease.owner.lastName}
                    </span>
                  </div>
                )}
              </Section>

              {data.lease.alerts && data.lease.alerts.length > 0 && (
                <Section title={`Open Alerts (${data.lease.alerts.length})`}>
                  <div className="flex flex-col gap-2">
                    {data.lease.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-start gap-2.5 border-l-2 pl-2.5 ${SEVERITY_COLOR[alert.severity] ?? 'border-l-transparent'}`}
                      >
                        <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${alert.severity === 'CRITICAL' ? 'text-danger' : alert.severity === 'WARNING' ? 'text-warning' : 'text-info'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 leading-snug">{alert.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{alert.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {data.paymentSeries.length > 1 && (
                <Section title="Payment Trend">
                  <ResponsiveContainer width="100%" height={80}>
                    <AreaChart data={data.paymentSeries} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="drawerGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={c.brand} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={c.brand} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="period" hide />
                      <Tooltip
                        contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 11, color: c.tooltipText }}
                        labelStyle={{ color: c.tooltipLabel }}
                        formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke={c.brand}
                        strokeWidth={1.5}
                        fill="url(#drawerGrad)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                    <TrendingUp className="h-3 w-3" />
                    Last {data.paymentSeries.length} months
                  </div>
                </Section>
              )}

              <Section title="Actions">
                <div className="flex flex-wrap gap-2">
                  {data.lease.renewalStage === 'NOT_STARTED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startRenewal.mutate(data.lease.id)}
                      loading={startRenewal.isPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Start Renewal
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markContacted.mutate(data.lease.id)}
                    loading={markContacted.isPending}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Mark Contacted
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => snooze.mutate(data.lease.id)}
                    loading={snooze.isPending}
                  >
                    <BellOff className="h-3.5 w-3.5" />
                    Snooze 7d
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { onClose(); navigate(`/leases/${data.lease.id}`); }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Full Details
                  </Button>
                </div>
              </Section>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function DaysRemaining({ endDate }: { endDate: string }) {
  const days = daysUntil(endDate);
  const color = days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : 'text-fg';
  const bg = days <= 30 ? 'bg-danger/10 border-danger/30' : days <= 60 ? 'bg-warning/10 border-warning/30' : 'bg-surface-200 border-surface-400/40';
  return (
    <div className={`rounded-xl border px-4 py-2 ${bg}`}>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{days >= 365 ? +(days / 365).toFixed(1) : Math.max(0, days)}</p>
      <p className="text-xs text-slate-500">{days >= 365 ? 'years remaining' : 'days remaining'}</p>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="bg-surface-100 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${danger ? 'text-warning' : 'text-slate-200'}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-surface-400/30 px-5 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      {children}
    </div>
  );
}
