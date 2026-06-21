import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertTriangle, Megaphone, Flag, Loader2 } from 'lucide-react';
import { adminService, type FeatureFlag, type Announcement } from '@/services/admin.service';
import { cn } from '@/utils/cn';

const TYPE_STYLES: Record<string, string> = {
  INFO:    'bg-brand-600/20 text-brand-300 border-brand-500/30',
  WARNING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  SUCCESS: 'bg-success/15 text-success border-success/30',
  DANGER:  'bg-danger/15 text-danger border-danger/30',
};


function FlagsSection({ secret }: { secret: string }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '', enabled: false });
  const qc = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['admin', 'flags', secret],
    queryFn: () => adminService.getFlags(secret),
  });

  const createMut = useMutation({
    mutationFn: () => adminService.createFlag(secret, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'flags'] }); setCreating(false); setForm({ key: '', name: '', description: '', enabled: false }); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => adminService.updateFlag(secret, id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deleteFlag(secret, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });

  return (
    <div className="rounded-xl border border-surface-400/40 bg-surface-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-slate-500" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Feature Flags</h3>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <Plus className="h-3.5 w-3.5" /> New flag
        </button>
      </div>

      {creating && (
        <div className="mb-4 rounded-xl border border-brand-500/30 bg-brand-600/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-300">New Feature Flag</p>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Key (e.g. new_dashboard)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })}
              className="h-9 rounded-lg border border-surface-400/40 bg-surface-200 px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60" />
            <input placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-9 rounded-lg border border-surface-400/40 bg-surface-200 px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60" />
          </div>
          <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="h-9 w-full rounded-lg border border-surface-400/40 bg-surface-200 px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="sr-only peer" />
              <div className={cn('h-4 w-7 rounded-full transition-colors', form.enabled ? 'bg-brand-500' : 'bg-surface-400')} />
              <span className="text-xs text-slate-400">Enabled by default</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={!form.key || !form.name || createMut.isPending}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-40">
                {createMut.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
      ) : (flags ?? []).length === 0 ? (
        <p className="text-xs text-slate-600 py-4 text-center">No feature flags yet.</p>
      ) : (
        <div className="space-y-2">
          {(flags ?? []).map((flag: FeatureFlag) => (
            <div key={flag.id} className="flex items-center gap-4 rounded-lg border border-surface-400/30 bg-surface-200/50 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200">{flag.name}</p>
                <p className="text-[11px] text-slate-500 font-mono">{flag.key}</p>
                {flag.description && <p className="text-[11px] text-slate-600 mt-0.5">{flag.description}</p>}
              </div>
              <button
                onClick={() => toggleMut.mutate({ id: flag.id, enabled: !flag.enabled })}
                className={cn('relative h-5 w-9 rounded-full transition-colors shrink-0', flag.enabled ? 'bg-brand-500' : 'bg-surface-400')}
              >
                <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', flag.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
              </button>
              <button onClick={() => deleteMut.mutate(flag.id)} className="text-slate-600 hover:text-danger transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function AnnouncementsSection({ secret }: { secret: string }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', type: 'INFO', target: 'ALL', active: true, endsAt: '' });
  const qc = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['admin', 'announcements', secret],
    queryFn: () => adminService.getAnnouncements(secret),
  });

  const createMut = useMutation({
    mutationFn: () => adminService.createAnnouncement(secret, { ...form, type: form.type as Announcement['type'], target: form.target as Announcement['target'], endsAt: form.endsAt || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }); setCreating(false); setForm({ title: '', body: '', type: 'INFO', target: 'ALL', active: true, endsAt: '' }); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => adminService.updateAnnouncement(secret, id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deleteAnnouncement(secret, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  });

  return (
    <div className="rounded-xl border border-surface-400/40 bg-surface-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-slate-500" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Announcements</h3>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <Plus className="h-3.5 w-3.5" /> New announcement
        </button>
      </div>

      {creating && (
        <div className="mb-4 rounded-xl border border-surface-400/40 bg-surface-200/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-300">New Announcement</p>
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="h-9 w-full rounded-lg border border-surface-400/40 bg-surface-200 px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60" />
          <textarea placeholder="Message body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={2}
            className="w-full rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 resize-none" />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="h-9 rounded-lg border border-surface-400/40 bg-surface-200 px-3 text-xs text-slate-200 focus:outline-none">
              {['INFO', 'WARNING', 'SUCCESS', 'DANGER'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="h-9 rounded-lg border border-surface-400/40 bg-surface-200 px-3 text-xs text-slate-200 focus:outline-none">
              {['ALL', 'ESSENTIALS', 'PROFESSIONAL', 'EXECUTIVE'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input type="date" placeholder="Expires (optional)" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className="h-9 rounded-lg border border-surface-400/40 bg-surface-200 px-3 text-xs text-slate-200 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.title || !form.body || createMut.isPending}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-40">
              {createMut.isPending ? 'Sending…' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
      ) : (items ?? []).length === 0 ? (
        <p className="text-xs text-slate-600 py-4 text-center">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {(items ?? []).map((item: Announcement) => (
            <div key={item.id} className={cn('rounded-lg border px-4 py-3', TYPE_STYLES[item.type] ?? 'border-surface-400/30 bg-surface-200/50')}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase">{item.type}</span>
                    <span className="text-[10px] text-slate-500">→ {item.target}</span>
                    {item.endsAt && <span className="text-[10px] text-slate-500">expires {new Date(item.endsAt).toLocaleDateString()}</span>}
                  </div>
                  <p className="text-xs font-semibold text-slate-200">{item.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.body}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleMut.mutate({ id: item.id, active: !item.active })}
                    className={cn('relative h-5 w-9 rounded-full transition-colors', item.active ? 'bg-brand-500' : 'bg-surface-400')}>
                    <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', item.active ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                  <button onClick={() => deleteMut.mutate(item.id)} className="text-slate-600 hover:text-danger transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function MaintenanceSection({ secret }: { secret: string }) {
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin', 'maintenance', secret],
    queryFn: () => adminService.getMaintenance(secret),
  });

  useEffect(() => {
    if (data?.message !== undefined) setMsg(data.message);
  }, [data?.message]);

  const mut = useMutation({
    mutationFn: ({ enabled }: { enabled: boolean }) => adminService.setMaintenance(secret, enabled, msg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'maintenance'] }),
  });

  const enabled = data?.enabled ?? false;

  return (
    <div className={cn('rounded-xl border p-5', enabled ? 'border-danger/40 bg-danger/5' : 'border-surface-400/40 bg-surface-100')}>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className={cn('h-4 w-4', enabled ? 'text-danger' : 'text-slate-500')} />
        <h3 className={cn('text-xs font-semibold uppercase tracking-widest', enabled ? 'text-danger' : 'text-slate-500')}>
          Maintenance Mode {enabled ? '— ACTIVE' : ''}
        </h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        When enabled, all users see a maintenance page instead of the app. Admins can still access the platform.
      </p>
      <textarea
        placeholder="Maintenance message shown to users…"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        rows={2}
        className="mb-3 w-full rounded-lg border border-surface-400/40 bg-surface-200 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 resize-none"
      />
      <div className="flex gap-3">
        <button
          onClick={() => mut.mutate({ enabled: true })}
          disabled={enabled || mut.isPending}
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-xs font-semibold text-danger hover:bg-danger/20 disabled:opacity-40 transition-colors"
        >
          Enable maintenance
        </button>
        <button
          onClick={() => mut.mutate({ enabled: false })}
          disabled={!enabled || mut.isPending}
          className="rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-xs font-semibold text-success hover:bg-success/20 disabled:opacity-40 transition-colors"
        >
          Disable maintenance
        </button>
      </div>
    </div>
  );
}


export function PlatformTab({ secret }: { secret: string }) {
  return (
    <div className="space-y-6">
      <MaintenanceSection secret={secret} />
      <AnnouncementsSection secret={secret} />
      <FlagsSection secret={secret} />
    </div>
  );
}
