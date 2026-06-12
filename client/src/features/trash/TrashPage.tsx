import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, Building2, FileText, Users, AlertTriangle, Clock } from 'lucide-react';
import { trashService, type TrashedProperty, type TrashedLease, type TrashedTenant, type TrashItemType } from '@/services/trash.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

// ─── Urgency badge ─────────────────────────────────────────────────────────────

function DaysLeftBadge({ days }: { days: number }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
      days <= 3  ? 'bg-danger/15 text-danger' :
      days <= 7  ? 'bg-warning/15 text-warning' :
                   'bg-surface-300/60 text-slate-400',
    )}>
      <Clock className="h-3 w-3" />
      {days}d left
    </span>
  );
}

// ─── Action buttons ────────────────────────────────────────────────────────────

function ItemActions({ type, id, onRestore, onPurge, loading }: {
  type: TrashItemType;
  id: string;
  onRestore: (type: TrashItemType, id: string) => void;
  onPurge:   (type: TrashItemType, id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => onRestore(type, id)}
        disabled={loading}
        title="Restore"
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-400/30 bg-surface-200/60 hover:bg-brand-600/20 hover:border-brand-500/30 hover:text-brand-300 px-2.5 py-1.5 text-xs text-slate-300 transition-colors disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Restore
      </button>
      <button
        onClick={() => onPurge(type, id)}
        disabled={loading}
        title="Delete permanently"
        className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/10 hover:bg-danger/20 px-2.5 py-1.5 text-xs text-danger transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────

function Section<T extends { id: string; daysLeft: number }>({
  title, icon: Icon, items, renderRow, type, onRestore, onPurge, loading,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: T[];
  renderRow: (item: T) => React.ReactNode;
  type: TrashItemType;
  onRestore: (type: TrashItemType, id: string) => void;
  onPurge:   (type: TrashItemType, id: string) => void;
  loading: boolean;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-500">{items.length}</span>
      </div>
      <div className="rounded-xl border border-surface-400/30 overflow-hidden divide-y divide-surface-400/20">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 px-4 py-3 bg-surface-100/40 hover:bg-surface-100/70 transition-colors">
            <div className="flex-1 min-w-0">
              {renderRow(item)}
            </div>
            <DaysLeftBadge days={item.daysLeft} />
            <ItemActions type={type} id={item.id} onRestore={onRestore} onPurge={onPurge} loading={loading} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TrashPage() {
  const qc = useQueryClient();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['trash'],
    queryFn: trashService.list,
  });

  const restoreMutation = useMutation({
    mutationFn: ({ type, id }: { type: TrashItemType; id: string }) => trashService.restore(type, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trash'] }),
  });

  const purgeMutation = useMutation({
    mutationFn: ({ type, id }: { type: TrashItemType; id: string }) => trashService.purge(type, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trash'] }),
  });

  const emptyMutation = useMutation({
    mutationFn: trashService.empty,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trash'] }); setConfirmEmpty(false); },
  });

  const onRestore = (type: TrashItemType, id: string) => restoreMutation.mutate({ type, id });
  const onPurge   = (type: TrashItemType, id: string) => purgeMutation.mutate({ type, id });
  const isMutating = restoreMutation.isPending || purgeMutation.isPending || emptyMutation.isPending;

  const total = (data?.properties.length ?? 0) + (data?.leases.length ?? 0) + (data?.tenants.length ?? 0);
  const isEmpty = !isLoading && total === 0;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Trash"
        description="Items deleted in the last 30 days. After 30 days they are permanently removed."
        actions={total > 0 ? (
          confirmEmpty ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Permanently delete all {total} items?</span>
              <button
                onClick={() => emptyMutation.mutate()}
                disabled={isMutating}
                className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/80 transition-colors disabled:opacity-50"
              >
                Yes, empty trash
              </button>
              <button onClick={() => setConfirmEmpty(false)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmEmpty(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/10 hover:bg-danger/20 px-3 py-1.5 text-xs font-semibold text-danger transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Empty Trash
            </button>
          )
        ) : undefined}
      />


      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600/20 border-t-brand-400" />
        </div>
      )}

      {isEmpty && (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-300/40">
                <Trash2 className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-300">Trash is empty</p>
              <p className="text-xs text-slate-500">Deleted properties, leases, and tenants appear here for 30 days.</p>
            </div>
          </CardBody>
        </Card>
      )}

      {!isLoading && !isEmpty && (
        <Card>
          <CardBody className="flex flex-col gap-6">
            {/* Warning banner */}
            <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning/80">
                Items in trash are permanently deleted after <span className="font-semibold text-warning">30 days</span>. Restore anything you need before it expires.
              </p>
            </div>

            <Section<TrashedProperty>
              title="Properties" icon={Building2} items={data?.properties ?? []} type="property"
              onRestore={onRestore} onPurge={onPurge} loading={isMutating}
              renderRow={(p) => (
                <div>
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.code} · {p.type} · {p.city}, {p.state}</p>
                </div>
              )}
            />

            <Section<TrashedLease>
              title="Leases" icon={FileText} items={data?.leases ?? []} type="lease"
              onRestore={onRestore} onPurge={onPurge} loading={isMutating}
              renderRow={(l) => (
                <div>
                  <p className="text-sm font-medium text-white truncate">{l.leaseNumber} — {l.tenant.name}</p>
                  <p className="text-xs text-slate-500">{l.property.name} · ${Number(l.baseRent).toLocaleString()}/mo</p>
                </div>
              )}
            />

            <Section<TrashedTenant>
              title="Tenants" icon={Users} items={data?.tenants ?? []} type="tenant"
              onRestore={onRestore} onPurge={onPurge} loading={isMutating}
              renderRow={(t) => (
                <div>
                  <p className="text-sm font-medium text-white truncate">{t.name}</p>
                  <p className="text-xs text-slate-500">{[t.company, t.email].filter(Boolean).join(' · ') || 'No contact info'}</p>
                </div>
              )}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
