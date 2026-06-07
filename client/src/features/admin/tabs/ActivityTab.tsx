import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { cn } from '@/utils/cn';

const ACTION_COLORS: Record<string, string> = {
  CREATE:       'text-success bg-success/10',
  UPDATE:       'text-brand-300 bg-brand-600/10',
  DELETE:       'text-danger bg-danger/10',
  PLAN_CHANGE:  'text-amber-400 bg-amber-500/10',
  ROLE_CHANGE:  'text-purple-400 bg-purple-500/10',
  IMPORT:       'text-cyan-400 bg-cyan-500/10',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ActivityTab({ secret }: { secret: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', secret, page],
    queryFn: () => adminService.getAuditLog(secret, page),
    enabled: !!secret,
  });

  const logs = data?.logs ?? [];
  const pages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Platform Audit Log</h2>
        <p className="text-xs text-slate-600">{total} entries</p>
      </div>

      <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-400/30 bg-surface-200/50">
              {['Time', 'User', 'Action', 'Entity', 'Record'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-400/20">
            {isLoading ? (
              <tr><td colSpan={5} className="py-12 text-center text-xs text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-xs text-slate-500">No activity recorded yet</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-surface-200/40 transition-colors">
                <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-3">
                  {log.user ? (
                    <p className="text-xs text-slate-300">{log.user.firstName} {log.user.lastName}</p>
                  ) : (
                    <p className="text-xs text-slate-600 italic">system</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', ACTION_COLORS[log.action] ?? 'text-slate-400 bg-surface-300')}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{log.entity}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{log.entityName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-400/30 px-4 py-3 bg-surface-200/30">
            <p className="text-xs text-slate-500">Page {page} of {pages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-400/40 text-slate-400 hover:text-slate-200 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-400/40 text-slate-400 hover:text-slate-200 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
