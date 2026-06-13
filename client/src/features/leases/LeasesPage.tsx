import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, FileText, ChevronRight, X, ChevronUp, ChevronDown,
  LayoutList, Zap, CheckSquare, Square, RefreshCw, Phone,
  BellOff, Download, SlidersHorizontal, Users, Plus, Columns3, Sparkles, Trash2,
} from 'lucide-react';
import RenewalKanban from './RenewalKanban';
import { leasesService, type RenewalStage, type PriorityLease, type Lease, type LeaseAlert } from '@/services/leases.service';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge, type StatusEntry } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate, daysUntil } from '@/utils/format';
import LeaseDrawer from './LeaseDrawer';
import LeaseFormModal from './LeaseFormModal';
import LeaseImportModal from './LeaseImportModal';
import type { ExtractedLease } from '@/services/ai.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<string, StatusEntry> = {
  LOW:      { label: 'Low',      variant: 'success', dot: true },
  MEDIUM:   { label: 'Medium',   variant: 'info',    dot: true },
  HIGH:     { label: 'High',     variant: 'warning', dot: true },
  CRITICAL: { label: 'Critical', variant: 'danger',  dot: true },
};

const LEASE_STATUS_CONFIG: Record<string, StatusEntry> = {
  ACTIVE:     { label: 'Active',     variant: 'success' },
  EXPIRED:    { label: 'Expired',    variant: 'neutral' },
  PENDING:    { label: 'Pending',    variant: 'brand'   },
  TERMINATED: { label: 'Terminated', variant: 'danger'  },
};

const STAGE_CONFIG: Record<string, StatusEntry> = {
  NOT_STARTED:       { label: 'Not started', variant: 'neutral' },
  CONTACTED:         { label: 'Contacted',   variant: 'info'    },
  NEGOTIATING:       { label: 'Negotiating', variant: 'warning' },
  DRAFT_SENT:        { label: 'Draft sent',  variant: 'brand'   },
  LEGAL_REVIEW:      { label: 'Legal review',variant: 'warning' },
  SCHEDULED_RENEWAL: { label: 'Scheduled',   variant: 'brand'   },
  SIGNED:            { label: 'Signed',      variant: 'success' },
};

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Terminated', value: 'TERMINATED' },
];

const EXPIRY_FILTERS = [
  { label: 'Any', value: '' },
  { label: '30d', value: '30' },
  { label: '60d', value: '60' },
  { label: '90d', value: '90' },
  { label: '180d', value: '180' },
];

type SortField = 'endDate' | 'baseRent';
type ViewMode = 'table' | 'priority' | 'kanban';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  if (!active) return <ChevronUp className="h-3 w-3 opacity-0 group-hover/th:opacity-60 transition-opacity" />;
  return order === 'asc'
    ? <ChevronUp className="h-3 w-3 text-brand-400" />
    : <ChevronDown className="h-3 w-3 text-brand-400" />;
}

function FilterTab({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40'
          : 'text-slate-500 border border-transparent hover:border-surface-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function DaysCell({ endDate, status }: { endDate: string; status: string }) {
  const days = daysUntil(endDate);
  const color = status !== 'ACTIVE' ? 'text-slate-600'
    : days <= 30 ? 'text-danger'
    : days <= 60 ? 'text-warning'
    : days <= 90 ? 'text-yellow-400'
    : 'text-slate-500';
  return (
    <td className="px-4 py-3">
      <p className="text-sm text-slate-300">{formatDate(endDate)}</p>
      <p className={`text-xs font-semibold tabular-nums mt-0.5 ${color}`}>
        {status !== 'ACTIVE' ? '—' : days > 0 ? `${days}d left` : 'Expired'}
      </p>
    </td>
  );
}

function PriorityBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round((score / 2500) * 100));
  const color = pct >= 70 ? 'bg-danger' : pct >= 40 ? 'bg-warning' : 'bg-brand-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-surface-400 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{score}</span>
    </div>
  );
}

// ─── Priority Queue View ──────────────────────────────────────────────────────

function PriorityQueueView({
  onOpenDrawer,
}: {
  onOpenDrawer: (id: string) => void;
}) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leases', 'priority-queue'],
    queryFn: leasesService.getPriorityQueue,
  });

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['leases'] }), [qc]);

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

  if (isLoading) return <PageLoader />;

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-surface-400/30">
        <EmptyState icon={Zap} title="No leases need immediate attention" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-400/30 divide-y divide-surface-400/20 overflow-hidden">
      {data.map((lease: PriorityLease, idx: number) => {
        const days = daysUntil(lease.endDate);
        const isActionBusy = startRenewal.isPending || markContacted.isPending || snooze.isPending;
        return (
          <div key={lease.id} className="flex items-start gap-4 px-5 py-4 hover:bg-surface-200/40 transition-colors">
            {/* Rank */}
            <div className="shrink-0 w-6 h-6 rounded-full bg-surface-300 flex items-center justify-center mt-0.5">
              <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{lease.tenant.name}</span>
                <span className="text-xs text-slate-600 font-mono">{lease.leaseNumber}</span>
                <StatusBadge status={lease.renewalRisk} config={RISK_CONFIG} />
                <StatusBadge status={lease.renewalStage} config={STAGE_CONFIG} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {lease.property.name}
                {lease.unitNumber ? ` · Unit ${lease.unitNumber}` : ''}
                {' · '}
                {formatCurrency(Number(lease.baseRent))}/mo
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600 italic">{lease.whyThisIsHere}</p>

              {/* Actions */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {lease.renewalStage === 'NOT_STARTED' && (
                  <Button variant="outline" size="sm" onClick={() => startRenewal.mutate(lease.id)} loading={startRenewal.isPending}>
                    <RefreshCw className="h-3 w-3" />
                    Start Renewal
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => markContacted.mutate(lease.id)} loading={markContacted.isPending} disabled={isActionBusy}>
                  <Phone className="h-3 w-3" />
                  Mark Contacted
                </Button>
                <Button variant="ghost" size="sm" onClick={() => snooze.mutate(lease.id)} loading={snooze.isPending} disabled={isActionBusy}>
                  <BellOff className="h-3 w-3" />
                  Snooze 7d
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onOpenDrawer(lease.id)}>
                  <ChevronRight className="h-3 w-3" />
                  Preview
                </Button>
              </div>
            </div>

            {/* Days + priority */}
            <div className="shrink-0 text-right">
              <p className={`text-2xl font-bold tabular-nums ${days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : 'text-white'}`}>
                {Math.max(0, days)}
              </p>
              <p className="text-xs text-slate-500">days left</p>
              <div className="mt-1 flex justify-end">
                <PriorityBar score={lease.priorityScore} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

function BulkBar({
  count, onAssignOwner, onStartRenewal, onExport, onClear,
  busy,
}: {
  count: number;
  onAssignOwner: (userId: string) => void;
  onStartRenewal: () => void;
  onExport: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  const [showAssign, setShowAssign] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: authService.getUsers,
    staleTime: 5 * 60 * 1000,
    enabled: count > 0,
  });

  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-surface-400/60 bg-surface-100 px-5 py-3 shadow-2xl">
      <span className="text-sm font-medium text-white">{count} selected</span>
      <div className="h-4 w-px bg-surface-400/60" />
      <div className="relative">
        <Button variant="ghost" size="sm" onClick={() => setShowAssign((v) => !v)} disabled={busy}>
          <Users className="h-3.5 w-3.5" />
          Assign Owner
        </Button>
        {showAssign && (
          <div className="absolute bottom-full left-0 mb-2 w-52 rounded-lg border border-surface-400/60 bg-surface-100 p-2 shadow-xl">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1">Select owner</p>
            {users?.map((u) => (
              <button
                key={u.id}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-300 hover:bg-surface-300 hover:text-white transition-colors"
                onClick={() => { onAssignOwner(u.id); setShowAssign(false); }}
              >
                {u.firstName} {u.lastName}
                <span className="ml-1.5 text-[10px] text-slate-600">{u.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onStartRenewal} disabled={busy} loading={busy}>
        <RefreshCw className="h-3.5 w-3.5" />
        Start Renewal
      </Button>
      <Button variant="ghost" size="sm" onClick={onExport} disabled={busy}>
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>
      <button onClick={onClear} className="ml-1 rounded-md p-1 text-slate-500 hover:text-white transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Filter chip ─────────────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-brand-600/30 bg-brand-600/10 px-2.5 py-0.5 text-xs text-brand-300">
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LeasesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [riskFilter, setRiskFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [hasAlertsFilter, setHasAlertsFilter] = useState<'' | 'true' | 'false'>('');
  const [sortBy, setSortBy] = useState<SortField>('endDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerLeaseId, setDrawerLeaseId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importedValues, setImportedValues] = useState<Partial<Record<string, string>> | null>(null);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = searchParams.get('propertyId') ?? undefined;

  const [deletingLeaseId, setDeletingLeaseId] = useState<string | null>(null);
  const [confirmLeaseId, setConfirmLeaseId]   = useState<string | null>(null);

  const handleDeleteLease = async (id: string) => {
    setConfirmLeaseId(null);
    setDeletingLeaseId(id);
    try {
      await leasesService.deleteLease(id);
      qc.setQueriesData<{ data: { id: string }[]; meta: unknown }>(
        { queryKey: ['leases'] },
        (old) => old ? { ...old, data: old.data.filter((l) => l.id !== id) } : old,
      );
      qc.invalidateQueries({ queryKey: ['leases'] });
    } finally {
      setDeletingLeaseId(null);
    }
  };

  const bulkMutation = useMutation({
    mutationFn: async (payload: { action: 'startRenewal' | 'exportCsv' | 'assignOwner'; ownerUserId?: string }) => {
      const { action, ownerUserId } = payload;
      if (action === 'exportCsv') {
        await leasesService.bulkExportCsv([...selectedIds]);
      } else {
        await leasesService.bulk({ ids: [...selectedIds], action, ownerUserId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] });
      setSelectedIds(new Set());
    },
  });

  function handleSort(field: SortField) {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
    setPage(1);
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[]) {
    if (ids.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  }

  const queryParams = useMemo(() => ({
    search: search || undefined,
    status: statusFilter || undefined,
    renewalRisk: riskFilter || undefined,
    renewalStage: (stageFilter || undefined) as RenewalStage | undefined,
    propertyId,
    expiringWithinDays: expiryFilter ? Number(expiryFilter) : undefined,
    hasAlerts: hasAlertsFilter ? hasAlertsFilter === 'true' : undefined,
    page,
    limit: 20,
    sortBy,
    sortOrder,
  }), [search, statusFilter, riskFilter, stageFilter, propertyId, expiryFilter, hasAlertsFilter, page, sortBy, sortOrder]);

  const { data, isLoading } = useQuery({
    queryKey: ['leases', queryParams],
    queryFn: () => leasesService.getLeases(queryParams),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ['leases', 'stats'],
    queryFn: leasesService.getStats,
  });

  const activeFilters = useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = [];
    if (riskFilter) chips.push({ label: `Risk: ${riskFilter}`, clear: () => setRiskFilter('') });
    if (stageFilter) chips.push({ label: `Stage: ${STAGE_CONFIG[stageFilter]?.label ?? stageFilter}`, clear: () => setStageFilter('') });
    if (expiryFilter) chips.push({ label: `Expiring: ≤${expiryFilter}d`, clear: () => setExpiryFilter('') });
    if (hasAlertsFilter) chips.push({ label: `Alerts: ${hasAlertsFilter === 'true' ? 'Yes' : 'No'}`, clear: () => setHasAlertsFilter('') });
    if (propertyId) chips.push({ label: 'Filtered by property', clear: () => setSearchParams({}) });
    return chips;
  }, [riskFilter, stageFilter, expiryFilter, hasAlertsFilter, propertyId, setSearchParams]);

  const leaseIds = data?.data.map((l) => l.id) ?? [];
  const allSelected = leaseIds.length > 0 && leaseIds.every((id) => selectedIds.has(id));

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in pb-24">
      {/* Header + view toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Lease Intelligence</h1>
          <p className="mt-0.5 text-sm text-slate-500">Contract visibility & renewal operating console</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            Import PDF
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            New Lease
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-surface-400/60 bg-surface-200 p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'kanban' ? 'bg-surface-400 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-surface-400 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              onClick={() => setViewMode('priority')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'priority' ? 'bg-surface-400 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Zap className="h-3.5 w-3.5" />
              Priority
            </button>
          </div>
          </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="flex items-stretch divide-x divide-surface-400/30 rounded-xl border border-surface-400/30 overflow-hidden">
          {[
            { label: 'Active', value: stats.totalActive, color: 'text-success', onClick: () => { setStatusFilter('ACTIVE'); setExpiryFilter(''); setRiskFilter(''); setStageFilter(''); setSearch(''); setPage(1); setViewMode('table'); } },
            { label: 'Expiring 30d', value: stats.expiringIn30, color: 'text-danger', onClick: () => { setStatusFilter('ACTIVE'); setExpiryFilter('30'); setRiskFilter(''); setStageFilter(''); setSearch(''); setPage(1); setViewMode('table'); } },
            { label: 'Expiring 90d', value: stats.expiringIn90, color: 'text-warning', onClick: () => { setStatusFilter('ACTIVE'); setExpiryFilter('90'); setRiskFilter(''); setStageFilter(''); setSearch(''); setPage(1); setViewMode('table'); } },
            { label: 'Critical Risk', value: stats.byRisk.find((r) => r.renewalRisk === 'CRITICAL')?._count ?? 0, color: 'text-danger', onClick: () => { setStatusFilter('ACTIVE'); setRiskFilter('CRITICAL'); setExpiryFilter(''); setStageFilter(''); setSearch(''); setPage(1); setViewMode('table'); } },
          ].map((s) => (
            <button key={s.label} onClick={s.onClick} className="flex-1 flex flex-col items-center gap-0.5 px-6 py-3.5 hover:bg-surface-300/40 transition-colors">
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <Chip key={f.label} label={f.label} onRemove={f.clear} />
          ))}
          <button
            onClick={() => { setRiskFilter(''); setStageFilter(''); setExpiryFilter(''); setHasAlertsFilter(''); setSearchParams({}); }}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Pipeline (Kanban) */}
      {viewMode === 'kanban' && <RenewalKanban />}

      {/* Priority Queue */}
      {viewMode === 'priority' && (
        <PriorityQueueView onOpenDrawer={setDrawerLeaseId} />
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-3">
            {/* Status tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_TABS.map((tab) => (
                <FilterTab
                  key={tab.value}
                  active={statusFilter === tab.value}
                  onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                >
                  {tab.label}
                  {tab.value === 'ACTIVE' && stats && (
                    <span className="ml-1.5 text-slate-500">{stats.totalActive}</span>
                  )}
                  {tab.value === 'EXPIRED' && stats && (
                    <span className="ml-1.5 text-slate-500">
                      {stats.byStatus.find((s) => s.status === 'EXPIRED')?._count ?? 0}
                    </span>
                  )}
                </FilterTab>
              ))}
            </div>

            {/* Search + filter toggle */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  placeholder="Search tenant, property, lease #…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                />
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                  showFilters || activeFilters.length > 0
                    ? 'border-brand-600/40 bg-brand-600/20 text-brand-300'
                    : 'border-surface-500 text-slate-500 hover:text-slate-300 hover:border-surface-400'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}
              </button>
            </div>

            {/* Expanded filter panel */}
            {showFilters && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-surface-400/40 bg-surface-200/40 px-4 py-3 sm:grid-cols-4">
                <FilterGroup label="Risk">
                  {['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((r) => (
                    <FilterTab key={r} active={riskFilter === r} onClick={() => { setRiskFilter(r); setPage(1); }}>
                      {r || 'All'}
                    </FilterTab>
                  ))}
                </FilterGroup>
                <FilterGroup label="Expiring">
                  {EXPIRY_FILTERS.map((f) => (
                    <FilterTab key={f.value} active={expiryFilter === f.value} onClick={() => { setExpiryFilter(f.value); setPage(1); }}>
                      {f.label}
                    </FilterTab>
                  ))}
                </FilterGroup>
                <FilterGroup label="Renewal Stage">
                  {(['', 'NOT_STARTED', 'CONTACTED', 'NEGOTIATING', 'DRAFT_SENT', 'LEGAL_REVIEW', 'SCHEDULED_RENEWAL', 'SIGNED'] as const).map((s) => (
                    <FilterTab key={s} active={stageFilter === s} onClick={() => { setStageFilter(s); setPage(1); }}>
                      {s ? (STAGE_CONFIG[s]?.label ?? s) : 'All'}
                    </FilterTab>
                  ))}
                </FilterGroup>
                <FilterGroup label="Has Alerts">
                  {([['', 'All'], ['true', 'Yes'], ['false', 'No']] as const).map(([v, l]) => (
                    <FilterTab key={v} active={hasAlertsFilter === v} onClick={() => { setHasAlertsFilter(v); setPage(1); }}>
                      {l}
                    </FilterTab>
                  ))}
                </FilterGroup>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-surface-400/30 overflow-hidden">
            {isLoading ? (
              <PageLoader />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-400/40">
                      {/* Bulk select */}
                      <th className="px-4 py-3 w-8">
                        <button onClick={() => toggleAll(leaseIds)} className="text-slate-500 hover:text-white transition-colors">
                          {allSelected ? <CheckSquare className="h-4 w-4 text-brand-400" /> : <Square className="h-4 w-4" />}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Tenant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Property</th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 cursor-pointer select-none group/th"
                        onClick={() => handleSort('endDate')}
                      >
                        <div className="flex items-center gap-1">
                          Expiry
                          <SortIcon active={sortBy === 'endDate'} order={sortOrder} />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 cursor-pointer select-none group/th"
                        onClick={() => handleSort('baseRent')}
                      >
                        <div className="flex items-center gap-1">
                          Rent / mo
                          <SortIcon active={sortBy === 'baseRent'} order={sortOrder} />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Stage</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Owner</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Risk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-400/30">
                    {data?.data.map((lease) => (
                      <LeaseRow
                        key={lease.id}
                        lease={lease}
                        selected={selectedIds.has(lease.id)}
                        onToggle={() => toggleRow(lease.id)}
                        onRowClick={() => setDrawerLeaseId(lease.id)}
                        onNavigate={() => navigate(`/leases/${lease.id}`)}
                        onRequestDelete={() => setConfirmLeaseId(lease.id)}
                        onConfirmDelete={() => void handleDeleteLease(lease.id)}
                        onCancelDelete={() => setConfirmLeaseId(null)}
                        confirming={confirmLeaseId === lease.id}
                        deleting={deletingLeaseId === lease.id}
                      />
                    ))}
                  </tbody>
                </table>

                {data?.data.length === 0 && (
                  (!search && !riskFilter && !stageFilter && !expiryFilter && !hasAlertsFilter && !propertyId) ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <FileText className="h-9 w-9 text-slate-700 mb-3" />
                      <p className="text-sm font-semibold text-slate-300">No leases yet</p>
                      <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                        Import leases from a CSV or add them individually once you have properties set up.
                      </p>
                      <div className="flex items-center gap-2 mt-5">
                        <button
                          onClick={() => setImportOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
                        >
                          Import from CSV
                        </button>
                        <button
                          onClick={() => setAddOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200 hover:bg-surface-300 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors"
                        >
                          Add manually
                        </button>
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon={FileText} title="No leases match these filters" />
                  )
                )}

                {data && data.meta.pages > 1 && (
                  <div className="flex items-center justify-between border-t border-surface-400/40 px-5 py-3">
                    <p className="text-xs text-slate-600">{data.meta.total} leases</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={!data.meta.hasPrev}
                        className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-white transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-slate-600">{page} / {data.meta.pages}</span>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!data.meta.hasNext}
                        className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-white transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Bulk action bar */}
      <BulkBar
        count={selectedIds.size}
        busy={bulkMutation.isPending}
        onAssignOwner={(userId) => bulkMutation.mutate({ action: 'assignOwner', ownerUserId: userId })}
        onStartRenewal={() => bulkMutation.mutate({ action: 'startRenewal' })}
        onExport={() => bulkMutation.mutate({ action: 'exportCsv' })}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Drawer */}
      <LeaseDrawer leaseId={drawerLeaseId} onClose={() => setDrawerLeaseId(null)} />

      <LeaseFormModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setImportedValues(null); }}
        initialValues={importedValues ?? undefined}
      />
      <LeaseImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={(extracted: ExtractedLease) => {
          const notes = [
            extracted.renewalOptions ? `Renewal Options: ${extracted.renewalOptions}` : '',
            extracted.obligations    ? `Obligations: ${extracted.obligations}`         : '',
            extracted.notes          ? extracted.notes                                  : '',
          ].filter(Boolean).join('\n\n');
          setImportedValues({
            unitNumber:      extracted.unitNumber      ?? '',
            type:            extracted.leaseType       ?? 'GROSS',
            startDate:       extracted.startDate       ?? '',
            endDate:         extracted.endDate         ?? '',
            baseRent:        extracted.baseRent        != null ? String(extracted.baseRent)        : '',
            rentEscalation:  extracted.rentEscalation  != null ? String(extracted.rentEscalation)  : '0',
            securityDeposit: extracted.securityDeposit != null ? String(extracted.securityDeposit) : '',
            sqft:            extracted.sqft            != null ? String(extracted.sqft)            : '',
            notes,
          });
          setAddOpen(true);
        }}
      />
    </div>
  );
}

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: 'text-danger',
  WARNING: 'text-warning',
  INFO: 'text-brand-400',
};

function AlertTooltip({ alerts }: { alerts: LeaseAlert[] }) {
  return (
    <div className="absolute top-full left-0 z-50 mt-1.5 w-72 rounded-lg border border-surface-400/60 bg-surface-100 p-2.5 shadow-2xl pointer-events-none">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Open Alerts</p>
      <div className="flex flex-col gap-1.5">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 text-[10px] leading-none ${SEVERITY_DOT[a.severity] ?? 'text-slate-400'}`}>●</span>
            <span className="text-xs text-slate-300 leading-snug">{a.title ?? a.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaseRow({
  lease, selected, onToggle, onRowClick, onNavigate,
  onRequestDelete, onConfirmDelete, onCancelDelete, confirming, deleting,
}: {
  lease: Lease;
  selected: boolean;
  onToggle: () => void;
  onRowClick: () => void;
  onNavigate: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  confirming: boolean;
  deleting: boolean;
}) {
  const openAlerts = lease.alerts?.length ?? 0;
  return (
    <tr
      className={`cursor-pointer transition-colors group ${selected ? 'bg-brand-600/10' : 'hover:bg-surface-200/40'}`}
    >
      <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        {selected
          ? <CheckSquare className="h-4 w-4 text-brand-400" />
          : <Square className="h-4 w-4 text-slate-600 group-hover:text-slate-400" />}
      </td>
      <td className="px-4 py-3" onClick={onRowClick}>
        <p className="text-sm font-medium text-slate-200">{lease.tenant.name}</p>
        <p className="text-xs text-slate-500 font-mono mt-0.5">
          {lease.leaseNumber}{lease.unitNumber ? ` · ${lease.unitNumber}` : ''}
        </p>
        {openAlerts > 0 && (
          <span className="group/alert relative mt-0.5 inline-flex items-center gap-1 text-xs text-danger cursor-default">
            ● {openAlerts} alert{openAlerts > 1 ? 's' : ''}
            <span className="opacity-0 group-hover/alert:opacity-100 transition-opacity duration-150 pointer-events-none">
              <AlertTooltip alerts={lease.alerts!} />
            </span>
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400" onClick={onRowClick}>{lease.property.name}</td>
      <DaysCell endDate={lease.endDate} status={lease.status} />
      <td className="px-4 py-3 text-sm font-medium text-white tabular-nums" onClick={onRowClick}>
        {formatCurrency(Number(lease.baseRent))}
      </td>
      <td className="px-4 py-3" onClick={onRowClick}>
        <StatusBadge status={lease.renewalStage} config={STAGE_CONFIG} />
      </td>
      <td className="px-4 py-3 text-xs text-slate-400" onClick={onRowClick}>
        {lease.owner ? `${lease.owner.firstName} ${lease.owner.lastName}` : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3" onClick={onRowClick}>
        <StatusBadge status={lease.renewalRisk} config={RISK_CONFIG} />
      </td>
      <td className="px-4 py-3" onClick={onRowClick}>
        <StatusBadge status={lease.status} config={LEASE_STATUS_CONFIG} />
      </td>
      <td className="px-4 py-3 relative">
        {/* Default actions — fade out when confirming */}
        <div className={`flex items-center justify-end gap-1 transition-all duration-200 ${confirming ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:bg-danger/15 hover:text-danger transition-colors"
            title="Delete lease"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onNavigate} className="flex h-6 w-6 items-center justify-center rounded text-slate-600 hover:text-slate-300">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* Confirmation — fades in, absolute so it doesn't shift layout */}
        <div
          className={`absolute inset-0 flex items-center justify-end gap-2 px-4 transition-all duration-200 ${confirming ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-slate-400">Delete?</span>
          <button
            onClick={onConfirmDelete}
            disabled={deleting}
            className="rounded-md bg-danger px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
            className="rounded-md border border-surface-400/40 px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
