import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, AlertTriangle, Search } from 'lucide-react';
import { adminService } from '@/services/admin.service';

export function DataTab({ secret }: { secret: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'data-user-search', search],
    queryFn: () => adminService.getUsers(secret, { search, page: 1 }),
    enabled: search.trim().length > 1,
  });

  const { data: summary } = useQuery({
    queryKey: ['admin', 'data-summary', selected?.id],
    queryFn: () => adminService.getDataSummary(secret, selected!.id),
    enabled: !!selected,
  });
  const { data: records } = useQuery({
    queryKey: ['admin', 'records', selected?.id],
    queryFn: () => adminService.getUserRecords(secret, selected!.id),
    enabled: !!selected,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'data-summary', selected?.id] });
    qc.invalidateQueries({ queryKey: ['admin', 'records', selected?.id] });
  };

  const del = useMutation({
    mutationFn: (v: { type: string; id: string }) => adminService.deleteData(secret, v.type, v.id),
    onSuccess: invalidate,
  });
  const wipe = useMutation({
    mutationFn: () => adminService.wipeUserData(secret, selected!.id),
    onSuccess: () => { setConfirmWipe(false); invalidate(); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Select account</h2>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email…"
            className="w-full rounded-lg border border-surface-400/50 bg-surface-100 py-2 pl-9 pr-3 text-sm text-fg placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
          />
        </div>
        {search.trim().length > 1 && usersData && (
          <div className="mt-2 max-w-md divide-y divide-surface-400/30 overflow-hidden rounded-lg border border-surface-400/40 bg-surface-100">
            {usersData.users.length === 0 && <p className="px-4 py-3 text-xs text-slate-500">No matches.</p>}
            {usersData.users.map((u) => (
              <button
                key={u.id}
                onClick={() => { setSelected({ id: u.id, label: `${u.firstName} ${u.lastName} · ${u.email}` }); setSearch(''); }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-surface-200/50"
              >
                <span className="text-sm text-fg">{u.firstName} {u.lastName}</span>
                <span className="text-xs text-slate-500">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-fg">{selected.label}</p>
              <p className="text-[11px] text-slate-500">Deletes apply the same cascade rules as the app (soft-delete).</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:text-fg">Change</button>
          </div>

          {summary && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {([
                ['Properties', summary.properties], ['Leases', summary.leases], ['Tenants', summary.tenants],
                ['Tasks', summary.tasks], ['Open alerts', summary.openAlerts], ['Finance', summary.financialRecords],
              ] as const).map(([label, n]) => (
                <div key={label} className="rounded-xl border border-surface-400/40 bg-surface-100 px-3 py-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-fg">{n}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <RecordList title="Properties" items={records?.properties.map((p) => ({ id: p.id, label: `${p.name} (${p.code})` })) ?? []}
              onDelete={(id) => del.mutate({ type: 'property', id })} pending={del.isPending} note="Deleting a property also removes its leases, tasks and alerts." />
            <RecordList title="Tenants" items={records?.tenants.map((t) => ({ id: t.id, label: t.name })) ?? []}
              onDelete={(id) => del.mutate({ type: 'tenant', id })} pending={del.isPending} />
          </div>

          <div className="rounded-xl border border-danger/30 bg-danger/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <div>
                  <p className="text-sm font-semibold text-fg">Wipe all portfolio data</p>
                  <p className="text-[11px] text-slate-500">Removes every property, lease, tenant, task, alert and financial record. Keeps the login.</p>
                </div>
              </div>
              {confirmWipe ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Sure?</span>
                  <button onClick={() => wipe.mutate()} disabled={wipe.isPending} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {wipe.isPending ? 'Wiping…' : 'Confirm wipe'}
                  </button>
                  <button onClick={() => setConfirmWipe(false)} className="text-xs text-slate-500 hover:text-fg">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmWipe(true)} className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10">Wipe data</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordList({ title, items, onDelete, pending, note }: {
  title: string;
  items: { id: string; label: string }[];
  onDelete: (id: string) => void;
  pending: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
      <div className="flex items-center justify-between border-b border-surface-400/30 px-4 py-2.5">
        <span className="text-sm font-semibold text-fg">{title}</span>
        <span className="text-xs text-slate-500">{items.length}</span>
      </div>
      {note && <p className="px-4 pt-2 text-[11px] text-slate-500">{note}</p>}
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-slate-500">None.</p>
      ) : (
        <div className="max-h-72 divide-y divide-surface-400/30 overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="truncate text-sm text-slate-300">{it.label}</span>
              <button onClick={() => onDelete(it.id)} disabled={pending} className="ml-2 shrink-0 text-slate-500 hover:text-danger disabled:opacity-50" aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
