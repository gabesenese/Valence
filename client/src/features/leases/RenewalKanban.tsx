import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Clock, DollarSign, User, AlertTriangle } from 'lucide-react';
import { leasesService } from '@/services/leases.service';
import type { RenewalStage, KanbanLease, KanbanColumn } from '@/services/leases.service';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, daysUntil } from '@/utils/format';

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES: Array<{
  key: RenewalStage;
  label: string;
  borderTop: string;
  headerText: string;
}> = [
  { key: 'NOT_STARTED',       label: 'Not Started',  borderTop: 'border-t-slate-500/50',  headerText: 'text-slate-400' },
  { key: 'CONTACTED',         label: 'Contacted',     borderTop: 'border-t-blue-500/60',   headerText: 'text-blue-400' },
  { key: 'NEGOTIATING',       label: 'Negotiating',   borderTop: 'border-t-amber-500/60',  headerText: 'text-amber-400' },
  { key: 'DRAFT_SENT',        label: 'Draft Sent',    borderTop: 'border-t-violet-500/60', headerText: 'text-violet-400' },
  { key: 'LEGAL_REVIEW',      label: 'Legal Review',  borderTop: 'border-t-orange-500/60', headerText: 'text-orange-400' },
  { key: 'SCHEDULED_RENEWAL', label: 'Scheduled',     borderTop: 'border-t-teal-500/60',   headerText: 'text-teal-400' },
  { key: 'SIGNED',            label: 'Signed',        borderTop: 'border-t-success/60',    headerText: 'text-success' },
];

const RISK_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

// ─── Card content (shared between draggable card and overlay) ─────────────────

function CardContent({ lease }: { lease: KanbanLease }) {
  const days = daysUntil(lease.endDate);
  const daysColor =
    days <= 30 ? 'text-danger' :
    days <= 60 ? 'text-warning' :
    days <= 90 ? 'text-yellow-400' : 'text-slate-500';

  return (
    <>
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-semibold text-fg leading-snug">{lease.tenantName}</p>
        {lease.criticalAlerts > 0 && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-danger">
            <AlertTriangle className="h-3 w-3" />
            {lease.criticalAlerts}
          </span>
        )}
      </div>

      <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
        {lease.propertyName}{lease.unitNumber ? ` · ${lease.unitNumber}` : ''}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${daysColor}`}>
          <Clock className="h-3 w-3 shrink-0" />
          {days > 0 ? `${days}d` : 'Expired'}
        </span>
        <span className="flex items-center gap-0.5 text-[11px] text-slate-400 tabular-nums">
          <DollarSign className="h-3 w-3 shrink-0" />
          {formatCurrency(lease.baseRent)}
        </span>
        <Badge variant={RISK_VARIANT[lease.renewalRisk] ?? 'neutral'} dot>
          {lease.renewalRisk}
        </Badge>
      </div>

      {lease.owner && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
          <User className="h-3 w-3 shrink-0" />
          {lease.owner.firstName} {lease.owner.lastName}
        </p>
      )}
    </>
  );
}

// ─── Draggable card ───────────────────────────────────────────────────────────

function KanbanCard({ lease }: { lease: KanbanLease }) {
  const navigate = useNavigate();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lease.id,
    data: { lease },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => navigate(`/leases/${lease.id}`)}
      className={`rounded-lg border border-surface-400/40 bg-surface-100 p-3 cursor-grab active:cursor-grabbing select-none ${
        isDragging
          ? 'opacity-30 ring-1 ring-brand-500/30'
          : 'hover:border-surface-300/50'
      }`}
    >
      <CardContent lease={lease} />
    </div>
  );
}

// ─── Drag overlay card ────────────────────────────────────────────────────────

function CardOverlay({ lease }: { lease: KanbanLease }) {
  return (
    <div className="rounded-lg border border-brand-500/40 bg-surface-100 p-3 shadow-2xl ring-1 ring-brand-500/20 cursor-grabbing rotate-1 scale-105 w-[248px]">
      <CardContent lease={lease} />
    </div>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────

function KanbanCol({
  config,
  leases,
  totalRent,
  isDragging,
}: {
  config: (typeof STAGES)[number];
  leases: KanbanLease[];
  totalRent: number;
  isDragging: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: config.key });

  return (
    <div className="flex w-[248px] shrink-0 flex-col">
      {/* Header */}
      <div
        className={`rounded-t-lg border border-b-0 border-t-2 ${config.borderTop} px-3 py-2.5 transition-colors ${
          isOver
            ? 'border-surface-300/60 bg-surface-200/80'
            : 'border-surface-400/40 bg-surface-100/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${config.headerText}`}>{config.label}</span>
          <span className="text-xs font-medium text-slate-500 tabular-nums">{leases.length}</span>
        </div>
        {totalRent > 0 && (
          <p className="mt-0.5 text-[11px] text-slate-600 tabular-nums">
            {formatCurrency(totalRent)}/mo
          </p>
        )}
      </div>

      {/* Cards drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-b-lg border border-t-0 p-2 transition-colors ${
          isOver
            ? 'border-surface-300/60 bg-surface-200/30 ring-1 ring-inset ring-brand-500/20'
            : 'border-surface-400/40 bg-surface-50/40'
        }`}
        style={{ maxHeight: 'calc(100vh - 320px)', minHeight: isDragging ? '80px' : '64px', overflowY: 'auto' }}
      >
        {leases.length === 0 ? (
          <div className={`flex items-center justify-center rounded-md py-6 text-[11px] transition-colors ${
            isOver ? 'text-brand-400' : 'text-slate-700'
          }`}>
            {isOver ? 'Drop here' : '—'}
          </div>
        ) : (
          leases.map((lease) => (
            <KanbanCard key={lease.id} lease={lease} />
          ))
        )}

        {/* Drop target indicator when column has cards */}
        {isOver && leases.length > 0 && (
          <div className="rounded-md border-2 border-dashed border-brand-500/30 py-3 text-center text-[11px] text-brand-400">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors border ${
        active
          ? 'bg-brand-600/30 text-brand-300 border-brand-600/40'
          : 'text-slate-500 border-transparent hover:border-surface-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export default function RenewalKanban() {
  const qc = useQueryClient();
  const [activeCard, setActiveCard] = useState<KanbanLease | null>(null);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);

  // Require 8px movement to start drag — lets clicks pass through naturally
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['leases', 'kanban'],
    queryFn: leasesService.getKanban,
  });

  const data = useMemo<KanbanColumn[] | undefined>(() => {
    if (!rawData || expiryDays === null) return rawData;
    return rawData.map((col) => {
      const leases = col.leases.filter((l) => daysUntil(l.endDate) <= expiryDays);
      return { ...col, count: leases.length, totalRent: leases.reduce((s, l) => s + l.baseRent, 0), leases };
    });
  }, [rawData, expiryDays]);

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: RenewalStage }) =>
      leasesService.advanceStage(id, stage),

    onMutate: async ({ id, stage }) => {
      const snapshot = qc.getQueryData<KanbanColumn[]>(['leases', 'kanban']);

      qc.setQueryData<KanbanColumn[]>(['leases', 'kanban'], (old) => {
        if (!old) return old;
        const lease = old.flatMap((c) => c.leases).find((l) => l.id === id);
        if (!lease) return old;
        return old.map((col) => {
          if (col.stage === lease.renewalStage) {
            return { ...col, count: col.count - 1, totalRent: col.totalRent - lease.baseRent, leases: col.leases.filter((l) => l.id !== id) };
          }
          if (col.stage === stage) {
            const moved: KanbanLease = { ...lease, renewalStage: stage };
            const leases = [...col.leases, moved].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
            return { ...col, count: col.count + 1, totalRent: col.totalRent + lease.baseRent, leases };
          }
          return col;
        });
      });

      await qc.cancelQueries({ queryKey: ['leases', 'kanban'] });
      return { snapshot };
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['leases', 'kanban'], ctx.snapshot);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['leases', 'kanban'] });
    },
  });

  function handleDragStart(event: DragStartEvent) {
    const lease = rawData?.flatMap((c) => c.leases).find((l) => l.id === event.active.id);
    setActiveCard(lease ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const targetStage = over.id as RenewalStage;
    const lease = rawData?.flatMap((c) => c.leases).find((l) => l.id === active.id);
    if (!lease || lease.renewalStage === targetStage) return;

    moveMutation.mutate({ id: active.id as string, stage: targetStage });
  }

  const totalLeases = data?.reduce((s, c) => s + c.count, 0) ?? 0;
  const totalRent = data?.reduce((s, c) => s + c.totalRent, 0) ?? 0;

  if (isLoading) return <PageLoader />;

  const EXPIRY_OPTIONS: Array<{ label: string; value: number | null }> = [
    { label: 'All', value: null },
    { label: '30d', value: 30 },
    { label: '60d', value: 60 },
    { label: '90d', value: 90 },
    { label: '180d', value: 180 },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Filter + summary row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500 mr-1">Expiring:</span>
          {EXPIRY_OPTIONS.map((opt) => (
            <FilterPill key={opt.label} active={expiryDays === opt.value} onClick={() => setExpiryDays(opt.value)}>
              {opt.label}
            </FilterPill>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          <span><span className="font-semibold text-fg tabular-nums">{totalLeases}</span> leases</span>
          {totalRent > 0 && <span><span className="font-semibold text-fg tabular-nums">{formatCurrency(totalRent)}</span>/mo</span>}
          <span className="text-[11px] text-slate-600 hidden sm:block">Drag to move · Click to open</span>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {STAGES.map((config) => {
              const col = data?.find((c) => c.stage === config.key);
              return (
                <KanbanCol
                  key={config.key}
                  config={config}
                  leases={col?.leases ?? []}
                  totalRent={col?.totalRent ?? 0}
                  isDragging={activeCard !== null}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeCard ? <CardOverlay lease={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
