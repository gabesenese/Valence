import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, User, Calendar, DollarSign, TrendingUp,
  AlertTriangle, CheckCircle2, RefreshCw, Phone, Check,
  Send, FileSignature, MessageSquare, Clock, Pencil, Trash2,
  ChevronUp, ChevronDown, Eye, RotateCcw,
} from 'lucide-react';
import { leasesService, type RenewalStage } from '@/services/leases.service';
import LeaseFormModal from './LeaseFormModal';
import { alertsService } from '@/services/alerts.service';
import { authService } from '@/services/auth.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, formatRelative, daysUntil, formatPercent } from '@/utils/format';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

const RECORD_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  RECONCILED: 'success', PENDING: 'warning', FLAGGED: 'danger', DISPUTED: 'danger', VOID: 'neutral',
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-danger', WARNING: 'text-warning', INFO: 'text-info',
};

// Renewal pipeline stages in order
const PIPELINE: Array<{ stage: RenewalStage; label: string; icon: React.ReactNode }> = [
  { stage: 'CONTACTED',         label: 'Contact tenant',   icon: <Phone className="h-3.5 w-3.5" /> },
  { stage: 'NEGOTIATING',       label: 'Schedule meeting', icon: <Calendar className="h-3.5 w-3.5" /> },
  { stage: 'DRAFT_SENT',        label: 'Send draft',       icon: <Send className="h-3.5 w-3.5" /> },
  { stage: 'LEGAL_REVIEW',      label: 'Legal review',     icon: <FileSignature className="h-3.5 w-3.5" /> },
  { stage: 'SCHEDULED_RENEWAL', label: 'Confirm terms',    icon: <Check className="h-3.5 w-3.5" /> },
  { stage: 'SIGNED',            label: 'Execute',          icon: <FileSignature className="h-3.5 w-3.5" /> },
];

const STAGE_ORDER: RenewalStage[] = [
  'NOT_STARTED', 'CONTACTED', 'NEGOTIATING', 'DRAFT_SENT', 'LEGAL_REVIEW', 'SCHEDULED_RENEWAL', 'SIGNED',
];

const ACTION_LABEL: Record<string, string> = {
  RENEWAL_STARTED: 'Renewal started',
  RENEWAL_DATE_SET: 'Renewal date set',
  RENEWAL_DATE_CLEARED: 'Renewal date cleared',
  OWNER_ASSIGNED: 'Owner assigned',
  TENANT_CONTACTED: 'Tenant contacted',
  SNOOZED: 'Snoozed',
  REVIEWED: 'Marked reviewed',
  STAGE_ADVANCED: 'Stage advanced',
  NOTE_ADDED: 'Note added',
  NOTE_DELETED: 'Note deleted',
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function ChevronToggle({ open }: { open: boolean }) {
  return open
    ? <ChevronUp className="h-3 w-3" />
    : <ChevronDown className="h-3 w-3" />;
}

// ─── Pipeline step ────────────────────────────────────────────────────────────

function PipelineStep({
  step, index, completed, current, canUndo, onAdvance, onUndo, loading,
}: {
  step: typeof PIPELINE[0];
  index: number;
  completed: boolean;
  current: boolean;
  canUndo: boolean;
  onAdvance: () => void;
  onUndo: () => void;
  loading: boolean;
}) {
  return (
    <div className={`group/step flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150 ${
      current ? 'bg-brand-600/15 border border-brand-500/30' : 'border border-transparent'
    }`}>
      {/* Status circle — only two states: number or check. Never changes on hover. */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        completed
          ? 'border-success bg-success/20 text-success'
          : current
          ? 'border-brand-400 bg-brand-600/20 text-brand-300'
          : 'border-surface-500/50 text-slate-600'
      }`}>
        {loading
          ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          : completed
          ? <Check className="h-3.5 w-3.5" />
          : <span className="text-xs font-semibold tabular-nums">{index + 1}</span>
        }
      </div>

      <span className={`flex-1 text-sm font-medium ${
        completed ? 'text-slate-500' : current ? 'text-white' : 'text-slate-600'
      }`}>
        {step.label}
      </span>

      {/* Undo — separate from the circle, only last completed step */}
      {canUndo && (
        <button
          onClick={onUndo}
          disabled={loading}
          className="opacity-0 group-hover/step:opacity-100 transition-opacity flex items-center gap-1 text-xs text-slate-500 hover:text-danger disabled:opacity-40 shrink-0"
        >
          <RotateCcw className="h-3 w-3" /> undo
        </button>
      )}

      {current && (
        <button
          onClick={onAdvance}
          disabled={loading}
          className="shrink-0 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-40"
        >
          Mark complete <Check className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [noteInput, setNoteInput] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteInput, setEditNoteInput] = useState('');
  const [showClosedAlerts, setShowClosedAlerts] = useState(false);
  const [assigningOwner, setAssigningOwner] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leases', id] });
    qc.invalidateQueries({ queryKey: ['leases', id, 'activity'] });
    qc.invalidateQueries({ queryKey: ['alerts'] });
  };

  const { data: lease, isLoading } = useQuery({
    queryKey: ['leases', id],
    queryFn: () => leasesService.getLease(id!),
    enabled: !!id,
  });

  const { data: activity } = useQuery({
    queryKey: ['leases', id, 'activity'],
    queryFn: () => leasesService.getActivity(id!),
    enabled: !!id,
  });

  const { data: notes } = useQuery({
    queryKey: ['leases', id, 'notes'],
    queryFn: () => leasesService.getNotes(id!),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: authService.getUsers,
    staleTime: 5 * 60 * 1000,
  });

  const { data: closedAlertsData } = useQuery({
    queryKey: ['alerts', 'closed', id],
    queryFn: () => alertsService.getAlerts({ leaseId: id, statuses: ['RESOLVED', 'DISMISSED'], limit: 10 } as never),
    enabled: !!id && showClosedAlerts,
  });

  const renewalMutation = useMutation({
    mutationFn: (date: string) => leasesService.setRenewalDateAction(id!, date),
    onSuccess: invalidate,
  });

  const clearRenewalMutation = useMutation({
    mutationFn: () => leasesService.clearRenewalDate(id!),
    onSuccess: invalidate,
  });

  const progressMutation = useMutation({
    mutationFn: (alertId: string) => alertsService.progress(alertId),
    onSuccess: invalidate,
  });

  const stageMutation = useMutation({
    mutationFn: (stage: RenewalStage) => leasesService.advanceStage(id!, stage),
    onSuccess: invalidate,
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) => leasesService.addNote(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases', id, 'notes'] });
      qc.invalidateQueries({ queryKey: ['leases', id, 'activity'] });
      setNoteInput('');
    },
  });

  const editNoteMutation = useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) =>
      leasesService.editNote(id!, noteId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases', id, 'notes'] });
      setEditingNoteId(null);
      setEditNoteInput('');
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => leasesService.deleteNote(id!, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leases', id, 'notes'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => alertsService.resolve(alertId),
    onSuccess: invalidate,
  });

  const dismissMutation = useMutation({
    mutationFn: (alertId: string) => alertsService.dismiss(alertId),
    onSuccess: invalidate,
  });

  const reopenMutation = useMutation({
    mutationFn: (alertId: string) => alertsService.reopen(alertId),
    onSuccess: invalidate,
  });

  const assignOwnerMutation = useMutation({
    mutationFn: (ownerUserId: string) => leasesService.assignOwner(id!, ownerUserId),
    onSuccess: () => { invalidate(); setAssigningOwner(false); },
  });

  if (isLoading) return <PageLoader />;
  if (!lease) return <div className="p-6 text-slate-500">Lease not found</div>;

  const days = daysUntil(lease.endDate);
  const isActive = lease.status === 'ACTIVE';
  const needsRenewal = isActive && !lease.renewalDate;
  const currentStageIdx = STAGE_ORDER.indexOf(lease.renewalStage);

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/leases')}>
          <ArrowLeft className="h-4 w-4" />
          Leases
        </Button>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-400 font-mono">{lease.leaseNumber}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white font-mono">{lease.leaseNumber}</h1>
            <Badge variant={RISK_VARIANT[lease.renewalRisk] ?? 'neutral'} dot>{lease.renewalRisk} RISK</Badge>
            <Badge variant={lease.status === 'ACTIVE' ? 'success' : 'neutral'}>{lease.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {lease.property.name}{lease.unitNumber ? ` · Unit ${lease.unitNumber}` : ''} · {lease.tenant.name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit Lease
          </Button>
          {isActive && (
          <div className={`text-right px-4 py-2 rounded-xl border ${
            days <= 30 ? 'border-danger/30 bg-danger/10' :
            days <= 60 ? 'border-warning/30 bg-warning/10' :
            'border-surface-400/40 bg-surface-200'
          }`}>
            <p className={`text-3xl font-bold tabular-nums ${days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : 'text-white'}`}>
              {days > 0 ? days : 0}
            </p>
            <p className="text-xs text-slate-400">days remaining</p>
          </div>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Property</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <button
              onClick={() => navigate(`/properties/${lease.property.id}`)}
              className="flex items-center gap-2 hover:text-brand-300 transition-colors text-left"
            >
              <Building2 className="h-4 w-4 text-brand-400 shrink-0" />
              <span className="text-sm text-slate-200">{lease.property.name}</span>
            </button>
            <p className="text-xs text-slate-500 font-mono">{lease.property.code}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tenant</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm text-slate-200">{lease.tenant.name}</span>
            </div>
            {lease.tenant.email && (
              <a href={`mailto:${lease.tenant.email}`} className="text-xs text-slate-500 hover:text-brand-300 transition-colors">
                {lease.tenant.email}
              </a>
            )}
            <div className="pt-1 border-t border-surface-400/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />Owner
                </span>
                {!assigningOwner ? (
                  <button
                    onClick={() => setAssigningOwner(true)}
                    className="text-xs text-slate-400 hover:text-brand-300 transition-colors"
                  >
                    {lease.owner ? `${lease.owner.firstName} ${lease.owner.lastName}` : '+ Assign'}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      defaultValue={lease.ownerUserId ?? ''}
                      onChange={(e) => { if (e.target.value) assignOwnerMutation.mutate(e.target.value); }}
                      disabled={assignOwnerMutation.isPending}
                      className="h-7 rounded border border-surface-400 bg-surface-200 px-2 text-xs text-slate-100 focus:border-brand-500/60 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Select user…</option>
                      {users?.map((u) => (
                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setAssigningOwner(false)}
                      className="text-xs text-slate-600 hover:text-slate-300 transition-colors"
                    >✕</button>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Base Rent</span>
              <span className="text-sm font-semibold text-white">{formatCurrency(Number(lease.baseRent))}/mo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Annual</span>
              <span className="text-sm text-slate-300">{formatCurrency(Number(lease.baseRent) * 12)}/yr</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Escalation</span>
              <span className="text-sm text-slate-300">{formatPercent(Number(lease.rentEscalation) * 100, 2)} / yr</span>
            </div>
            {lease.securityDeposit && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Security Deposit</span>
                <span className="text-sm text-slate-300">{formatCurrency(Number(lease.securityDeposit))}</span>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lease Term</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Start</span>
              <span className="text-sm text-slate-300">{formatDate(lease.startDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">End</span>
              <span className={`text-sm font-medium ${days <= 60 ? 'text-warning' : 'text-slate-300'}`}>{formatDate(lease.endDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Type</span>
              <span className="text-sm text-slate-300">{lease.type}</span>
            </div>
            {lease.sqft && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sq. Ft.</span>
                <span className="text-sm text-slate-300">{Number(lease.sqft).toLocaleString()}</span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Renewal date card */}
        <Card>
          <CardHeader>
            <CardTitle>Renewal Date</CardTitle>
            {needsRenewal && <Badge variant="danger">Action needed</Badge>}
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <DatePicker
              value={lease.renewalDate?.slice(0, 10) ?? ''}
              onChange={(date) => renewalMutation.mutate(date)}
              onClear={lease.renewalDate ? () => clearRenewalMutation.mutate() : undefined}
              disabled={!isActive || renewalMutation.isPending || clearRenewalMutation.isPending}
              placeholder={isActive ? 'Set renewal date' : 'No renewal date'}
            />
          </CardBody>
        </Card>
      </div>

      {/* ── Renewal Pipeline ─────────────────────────────────────────────────── */}
      {isActive && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-brand-400" />
              <CardTitle>Renewal Pipeline</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {PIPELINE.filter(s => STAGE_ORDER.indexOf(s.stage) <= currentStageIdx && lease.renewalStage !== 'NOT_STARTED').length}
                /{PIPELINE.length} steps
              </span>
              <Badge variant={
                lease.renewalStage === 'SIGNED' ? 'success' :
                lease.renewalStage === 'NOT_STARTED' ? 'neutral' : 'brand'
              }>
                {lease.renewalStage.replace(/_/g, ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            {/* Progress bar */}
            <div className="mb-4 h-1.5 rounded-full bg-surface-400/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{
                  width: `${lease.renewalStage === 'NOT_STARTED' ? 0 : Math.round((currentStageIdx / PIPELINE.length) * 100)}%`,
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              {PIPELINE.map((step, i) => {
                const stepIdx = STAGE_ORDER.indexOf(step.stage);
                const completed = stepIdx <= currentStageIdx && lease.renewalStage !== 'NOT_STARTED';
                const isCurrent = stepIdx === currentStageIdx + 1;
                const canUndo = completed && stepIdx === currentStageIdx;
                const prevStage = STAGE_ORDER[stepIdx - 1] ?? 'NOT_STARTED';
                return (
                  <PipelineStep
                    key={step.stage}
                    step={step}
                    index={i}
                    completed={completed}
                    current={isCurrent}
                    canUndo={canUndo}
                    onAdvance={() => stageMutation.mutate(step.stage)}
                    onUndo={() => stageMutation.mutate(prevStage as RenewalStage)}
                    loading={stageMutation.isPending && (
                      stageMutation.variables === step.stage ||
                      stageMutation.variables === prevStage
                    )}
                  />
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Open Alerts (actionable) ──────────────────────────────────────────── */}
      {lease.alerts && lease.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <CardTitle>Open Alerts</CardTitle>
            </div>
          </CardHeader>
          <div className="divide-y divide-surface-400/30">
            {lease.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 px-5 py-3.5 border-l-2 ${
                  alert.severity === 'CRITICAL' ? 'border-l-danger/60' :
                  alert.severity === 'WARNING' ? 'border-l-warning/40' : 'border-l-transparent'
                }`}
              >
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[alert.severity] ?? 'text-slate-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{alert.description}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {alert.status === 'OPEN' && (
                    <button
                      onClick={() => progressMutation.mutate(alert.id)}
                      disabled={progressMutation.isPending}
                      title="Mark as in review"
                      className="flex items-center gap-1.5 rounded-full border border-slate-600/50 bg-surface-300/40 px-2.5 py-1 text-xs text-slate-500 transition-all hover:border-brand-500/50 hover:bg-brand-600/10 hover:text-brand-300 disabled:opacity-40"
                    >
                      <Eye className="h-3 w-3" />
                      Mark in review
                    </button>
                  )}
                  {alert.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => reopenMutation.mutate(alert.id)}
                      disabled={reopenMutation.isPending}
                      title="Currently in review — click to revert to open"
                      className="flex items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-600/15 px-2.5 py-1 text-xs text-brand-300 transition-all hover:border-warning/40 hover:bg-warning/10 hover:text-warning disabled:opacity-40"
                    >
                      <Eye className="h-3 w-3" />
                      <span>in review</span>
                      <RotateCcw className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resolveMutation.mutate(alert.id)}
                    loading={resolveMutation.isPending}
                    title="Resolve"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissMutation.mutate(alert.id)}
                    loading={dismissMutation.isPending}
                    title="Dismiss"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>

        </Card>
      )}

      {/* Closed alerts — always available, not gated on having open alerts */}
      <div className="rounded-lg border border-surface-400/30">
        <button
          onClick={() => setShowClosedAlerts((v) => !v)}
          className="flex w-full items-center gap-1.5 px-5 py-3 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          <ChevronToggle open={showClosedAlerts} />
          {showClosedAlerts ? 'Hide' : 'Show'} recently resolved / dismissed alerts
        </button>
        {showClosedAlerts && (
          <div className="border-t border-surface-400/30 px-5 py-3 flex flex-col gap-2">
            {closedAlertsData?.data && closedAlertsData.data.length > 0 ? (
              closedAlertsData.data.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-400 line-through">{alert.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 capitalize">{alert.status.toLowerCase()}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reopenMutation.mutate(alert.id)}
                    loading={reopenMutation.isPending}
                  >
                    Reopen
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-600">No recently closed alerts.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Payment History ───────────────────────────────────────────────────── */}
      {lease.financialRecords && lease.financialRecords.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success" />
              <CardTitle>Payment History</CardTitle>
            </div>
            <span className="text-xs text-slate-500">Last {lease.financialRecords.length} records</span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {['Period', 'Type', 'Amount', 'Status', 'Paid'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400/20">
                {lease.financialRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-surface-200/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-400">{formatDate(rec.periodStart)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{rec.type}</td>
                    <td className={`px-4 py-2.5 text-sm font-medium tabular-nums ${rec.type === 'EXPENSE' ? 'text-danger' : 'text-white'}`}>
                      {rec.type === 'EXPENSE' ? '-' : ''}{formatCurrency(Number(rec.amount))}
                      {rec.discrepancy && Number(rec.discrepancy) !== 0 && (
                        <span className="ml-1.5 text-xs text-danger">(Δ {formatCurrency(Number(rec.discrepancy))})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={RECORD_STATUS_VARIANT[rec.status] ?? 'neutral'}>{rec.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {rec.paidDate ? formatDate(rec.paidDate) : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Notes + Activity ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Notes */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand-400" />
              <CardTitle>Notes</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {/* Add note */}
            <div className="flex flex-col gap-2">
              <textarea
                ref={noteRef}
                rows={2}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add a note…"
                className="w-full resize-none rounded-lg border border-surface-400 bg-surface-200 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => noteMutation.mutate(noteInput)}
                  loading={noteMutation.isPending}
                  disabled={!noteInput.trim()}
                >
                  Add Note
                </Button>
              </div>
            </div>

            {/* Notes list */}
            {notes && notes.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-surface-400/30 pt-3">
                {notes.map((note) => (
                  <div key={note.id} className="group/note flex gap-3">
                    <div className="h-7 w-7 shrink-0 rounded-full bg-brand-600/30 border border-brand-600/40 flex items-center justify-center text-xs font-semibold text-brand-300">
                      {note.author ? `${note.author.firstName[0]}${note.author.lastName[0]}` : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-300">
                          {note.author ? `${note.author.firstName} ${note.author.lastName}` : 'Unknown'}
                        </span>
                        <span className="text-xs text-slate-600">{formatRelative(note.createdAt)}</span>
                        {/* Edit / Delete — visible on hover */}
                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditNoteInput(note.body); }}
                            className="rounded p-1 text-slate-600 hover:text-brand-300 hover:bg-surface-300 transition-colors"
                            title="Edit note"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                            disabled={deleteNoteMutation.isPending}
                            className="rounded p-1 text-slate-600 hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                            title="Delete note"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {editingNoteId === note.id ? (
                        <div className="mt-1 flex flex-col gap-1.5">
                          <textarea
                            rows={2}
                            value={editNoteInput}
                            onChange={(e) => setEditNoteInput(e.target.value)}
                            className="w-full resize-none rounded-md border border-surface-400 bg-surface-200 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none"
                          />
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editNoteMutation.mutate({ noteId: note.id, body: editNoteInput })}
                              loading={editNoteMutation.isPending}
                              disabled={!editNoteInput.trim()}
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingNoteId(null); setEditNoteInput(''); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 text-sm text-slate-400 whitespace-pre-wrap">{note.body}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">No notes yet.</p>
            )}
          </CardBody>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <CardTitle>Activity</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            {activity && activity.length > 0 ? (
              <ol className="relative border-l border-surface-400/40 ml-2 space-y-3">
                {activity.map((entry) => {
                  const label = ACTION_LABEL[entry.actionType] ?? entry.actionType.replace(/_/g, ' ').toLowerCase();
                  const actor = entry.actor
                    ? `${entry.actor.firstName} ${entry.actor.lastName}`
                    : 'System';
                  const meta = entry.metadata as Record<string, unknown> | null;
                  return (
                    <li key={entry.id} className="ml-4">
                      <div className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-surface-500 border border-surface-400" />
                      <p className="text-xs font-medium text-slate-300">{label}</p>
                      <p className="text-xs text-slate-500">
                        {actor} · {formatRelative(entry.createdAt)}
                      </p>
                      {!!meta?.newStage && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          {String(meta.previousStage)} → {String(meta.newStage)}
                        </p>
                      )}
                      {!!meta?.renewalDate && (
                        <p className="mt-0.5 text-xs text-slate-600">{String(meta.renewalDate)}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-xs text-slate-600">No activity recorded yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Notes from lease record (original field) */}
      {lease.notes && (
        <Card>
          <CardHeader><CardTitle>Lease Notes</CardTitle></CardHeader>
          <CardBody>
            <p className="text-sm text-slate-400 whitespace-pre-wrap">{lease.notes}</p>
          </CardBody>
        </Card>
      )}

      <LeaseFormModal open={editOpen} onClose={() => setEditOpen(false)} lease={lease} />
    </div>
  );
}
