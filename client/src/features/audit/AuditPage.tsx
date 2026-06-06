import { useState, useEffect, useCallback } from 'react';
import { Building2, FileText, Users, UserCog, Upload, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { auditService, type AuditLogEntry } from '@/services/audit.service';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

// ─── Config ───────────────────────────────────────────────────────────────────

const ENTITY_FILTERS = [
  { key: '',          label: 'All'        },
  { key: 'property',  label: 'Properties' },
  { key: 'lease',     label: 'Leases'     },
  { key: 'tenant',    label: 'Tenants'    },
  { key: 'user',      label: 'Users'      },
];

const ACTION_META: Record<string, { label: string; color: string }> = {
  CREATE:      { label: 'Created',     color: 'text-success bg-success/10 border-success/20'    },
  UPDATE:      { label: 'Updated',     color: 'text-brand-300 bg-brand-600/10 border-brand-500/20' },
  DELETE:      { label: 'Deleted',     color: 'text-danger bg-danger/10 border-danger/20'        },
  IMPORT:      { label: 'Imported',    color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  PLAN_CHANGE: { label: 'Plan change', color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
  ROLE_CHANGE: { label: 'Role change', color: 'text-sky-300 bg-sky-500/10 border-sky-500/20'    },
};

const ENTITY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  property: Building2,
  lease:    FileText,
  tenant:   Users,
  user:     UserCog,
};

// ─── Row ──────────────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const action = ACTION_META[entry.action] ?? { label: entry.action, color: 'text-slate-400 bg-surface-300/30 border-surface-400/20' };
  const Icon = ENTITY_ICON[entry.entity] ?? UserCog;
  const actor = entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System';
  const hasDetail = entry.changes && Object.keys(entry.changes).length > 0;
  const hasMeta = entry.meta && Object.keys(entry.meta).length > 0;

  const ts = new Date(entry.createdAt);
  const timeStr = ts.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="border-b border-surface-400/20 last:border-0">
      <button
        onClick={() => (hasDetail || hasMeta) && setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
          (hasDetail || hasMeta) ? 'hover:bg-surface-200/30 cursor-pointer' : 'cursor-default',
        )}
      >
        {/* Entity icon */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-300/60">
          <Icon className="h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* Action badge */}
        <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', action.color)}>
          {action.label}
        </span>

        {/* Description */}
        <span className="flex-1 truncate text-sm text-slate-300">
          <span className="font-medium text-white">{actor}</span>
          {' '}
          {entry.entity}
          {entry.entityName ? <> · <span className="font-mono text-xs text-slate-400">{entry.entityName}</span></> : null}
        </span>

        {/* Time */}
        <span className="shrink-0 text-xs text-slate-600">{timeStr}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (hasDetail || hasMeta) && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-surface-100/50 border border-surface-400/20 px-3 py-2.5 font-mono text-xs text-slate-400 overflow-x-auto">
            <pre>{JSON.stringify(entry.changes ?? entry.meta, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<{ total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditService.list({ entity: entity || undefined, page, limit: 50 });
      setLogs(res.data);
      setMeta({ total: res.meta.total, pages: res.meta.pages });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [entity, page]);

  useEffect(() => { void fetch(); }, [fetch]);

  const handleEntityChange = (key: string) => { setEntity(key); setPage(1); };

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Audit Log</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {meta ? `${meta.total.toLocaleString()} events` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={fetch}
          className="flex items-center gap-1.5 rounded-lg border border-surface-400/30 bg-surface-200/50 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <Card>
        {/* Filter bar */}
        <div className="flex items-center gap-1 border-b border-surface-400/30 px-4 py-2">
          {ENTITY_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleEntityChange(key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                entity === key
                  ? 'bg-brand-600/20 text-brand-300'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-200/50',
              )}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-slate-600">
              {meta ? `Page ${page} of ${meta.pages || 1}` : ''}
            </span>
          </div>
        </div>

        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-surface-400 border-t-brand-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Upload className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">No events yet</p>
              <p className="text-xs text-slate-600">Actions on properties, leases, and tenants will appear here</p>
            </div>
          ) : (
            <div>
              {logs.map((entry) => <AuditRow key={entry.id} entry={entry} />)}
            </div>
          )}
        </CardBody>

        {/* Pagination */}
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-400/30 px-4 py-3">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="text-xs text-slate-600">{page} / {meta.pages}</span>
            <button
              disabled={page >= meta.pages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
