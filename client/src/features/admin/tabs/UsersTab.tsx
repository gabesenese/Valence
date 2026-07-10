import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, MoreHorizontal, ChevronLeft, ChevronRight, Loader2,
  KeyRound, Power, PowerOff, Trash2, UserCheck, CalendarDays, Activity, X,
} from 'lucide-react';
import { adminService, type AdminUser } from '@/services/admin.service';
import { useAuthStore } from '@/state/auth.store';
import { cn } from '@/utils/cn';

const PLANS = ['FREE', 'ESSENTIALS', 'PROFESSIONAL', 'EXECUTIVE'];
const ROLES = ['VIEWER', 'ANALYST', 'ADMIN', 'SUPER_ADMIN'];

const PLAN_COLORS: Record<string, string> = {
  ESSENTIALS:   'bg-brand-600/20 text-brand-300',
  PROFESSIONAL: 'bg-success/15 text-success',
  EXECUTIVE:    'bg-amber-500/15 text-amber-400',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  return m < 12 ? `${m}mo ago` : `${Math.floor(m / 12)}y ago`;
}

const JOURNEY_EVENTS: Record<string, { label: string; dot: string }> = {
  visitor:         { label: 'Visited',           dot: 'bg-slate-500' },
  signup:          { label: 'Signed up',         dot: 'bg-brand-500' },
  demo_started:    { label: 'Started demo',      dot: 'bg-violet-400' },
  setup_complete:  { label: 'Completed setup',   dot: 'bg-blue-400' },
  data_imported:   { label: 'Imported data',     dot: 'bg-teal-400' },
  first_insight:   { label: 'Reached first insight', dot: 'bg-success' },
  team_invited:    { label: 'Invited a teammate',   dot: 'bg-amber-400' },
  upgrade_clicked: { label: 'Clicked upgrade',   dot: 'bg-amber-500' },
  upgraded:        { label: 'Upgraded',          dot: 'bg-success' },
  return_visit:    { label: 'Returned',          dot: 'bg-slate-400' },
};

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function eventDetail(event: string, meta: Record<string, unknown>): string | null {
  if (event === 'data_imported') {
    const source = typeof meta.source === 'string' ? meta.source : null;
    const count = typeof meta.count === 'number' ? meta.count : null;
    const entity = typeof meta.entity === 'string' ? meta.entity : null;
    const parts = [source, count != null ? `${count} ${entity ?? 'rows'}` : entity].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }
  return null;
}

function JourneyModal({ user, secret, onClose }: { user: AdminUser; secret: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'journey', user.id, secret],
    queryFn: () => adminService.getUserJourney(secret, user.id),
    enabled: !!secret,
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-surface-400/60 bg-surface-100 shadow-card max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between border-b border-surface-400/30 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-400" />
              <h3 className="text-sm font-bold text-fg">Activation journey</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 font-mono">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</div>
        ) : !data || data.events.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">No activity recorded yet.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-px bg-surface-400/20 border-b border-surface-400/30">
              <div className="bg-surface-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Time to insight</p>
                <p className="mt-0.5 text-sm font-semibold text-fg tabular-nums">
                  {data.metrics.timeToFirstInsightMs != null ? formatDuration(data.metrics.timeToFirstInsightMs) : '—'}
                </p>
              </div>
              <div className="bg-surface-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Return visits</p>
                <p className="mt-0.5 text-sm font-semibold text-fg tabular-nums">{data.metrics.returnVisits}</p>
              </div>
              <div className="bg-surface-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Activated</p>
                <p className={cn('mt-0.5 text-sm font-semibold', data.metrics.reachedFirstInsight ? 'text-success' : 'text-slate-500')}>
                  {data.metrics.reachedFirstInsight ? 'Yes' : 'Not yet'}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <ol className="relative border-l border-surface-400/40 ml-1.5">
                {data.events.map((e, i) => {
                  const cfg = JOURNEY_EVENTS[e.event] ?? { label: e.event, dot: 'bg-slate-500' };
                  const detail = eventDetail(e.event, e.meta);
                  return (
                    <li key={i} className="mb-4 ml-4 last:mb-0">
                      <span className={cn('absolute -left-1.5 mt-1 h-3 w-3 rounded-full ring-4 ring-surface-100', cfg.dot)} />
                      <p className="text-xs font-medium text-slate-200">{cfg.label}</p>
                      {detail && <p className="text-[11px] text-slate-500">{detail}</p>}
                      <p className="text-[10px] text-slate-600">{fmtDateTime(e.createdAt)}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function UserActions({ user, secret, onDone }: { user: AdminUser; secret: string; onDone: () => void }) {
  const [open, setOpen]     = useState(false);
  const [confirm, setConfirm] = useState<'delete' | null>(null);
  const [showJourney, setShowJourney] = useState(false);
  const [trialEdit, setTrialEdit] = useState(false);
  const [trialDate, setTrialDate] = useState('');
  const [pos, setPos]       = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
  const btnRef              = useRef<HTMLButtonElement>(null);
  const qc                  = useQueryClient();
  const navigate            = useNavigate();
  const startImpersonation  = useAuthStore((s) => s.startImpersonation);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); onDone(); };

  const planMut    = useMutation({ mutationFn: (plan: string) => adminService.changePlan(secret, user.id, plan), onSuccess: invalidate });
  const roleMut    = useMutation({ mutationFn: (role: string) => adminService.changeRole(secret, user.id, role), onSuccess: invalidate });
  const activeMut  = useMutation({ mutationFn: (v: boolean)  => adminService.setActive(secret, user.id, v),     onSuccess: invalidate });
  const trialMut   = useMutation({ mutationFn: (d: string | null) => adminService.setTrial(secret, user.id, d), onSuccess: () => { setTrialEdit(false); invalidate(); } });
  const resetMut   = useMutation({ mutationFn: () => adminService.sendPasswordReset(secret, user.id), onSuccess: () => setOpen(false) });
  const impMut     = useMutation({
    mutationFn: () => adminService.impersonate(secret, user.id),
    onSuccess: (data) => {
      startImpersonation(data.user as never, data.token);
      navigate('/queue');
    },
  });
  const deleteMut  = useMutation({ mutationFn: () => adminService.deleteUser(secret, user.id), onSuccess: invalidate });

  const MENU_HEIGHT_ESTIMATE = 340;

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const right = window.innerWidth - r.right;
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow < MENU_HEIGHT_ESTIMATE + 8) {
        setPos({ bottom: window.innerHeight - r.top + 4, right });
      } else {
        setPos({ top: r.bottom + 4, right });
      }
    }
    setOpen(true);
  }

  if (confirm === 'delete') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Delete {user.firstName}?</span>
        <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="rounded px-2 py-1 text-[11px] font-semibold text-danger bg-danger/10 hover:bg-danger/20">
          {deleteMut.isPending ? '…' : 'Confirm'}
        </button>
        <button onClick={() => setConfirm(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
      </div>
    );
  }

  if (trialEdit) {
    return (
      <div className="flex items-center gap-2">
        <input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)}
          className="h-6 rounded border border-surface-400 bg-surface-200 px-2 text-[11px] text-slate-200" />
        <button onClick={() => trialMut.mutate(trialDate || null)} disabled={trialMut.isPending}
          className="rounded px-2 py-1 text-[11px] font-semibold text-brand-300 bg-brand-600/20 hover:bg-brand-600/30">
          {trialMut.isPending ? '…' : 'Save'}
        </button>
        <button onClick={() => setTrialEdit(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
      </div>
    );
  }

  return (
    <div>
      <button ref={btnRef} onClick={handleOpen}
        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-300 text-slate-500 hover:text-slate-300 transition-colors">
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 w-56 rounded-xl border border-surface-400/60 bg-surface-200 shadow-card overflow-hidden"
            style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}>

            <div className="px-3 py-2 border-b border-surface-400/30">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Plan</p>
              <div className="flex gap-1">
                {PLANS.map((p) => (
                  <button key={p} onClick={() => { planMut.mutate(p); setOpen(false); }}
                    className={cn('rounded px-2 py-0.5 text-[10px] font-medium transition-colors', user.plan === p ? 'bg-brand-600/30 text-brand-300' : 'text-slate-400 hover:text-slate-200')}>
                    {p.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 py-2 border-b border-surface-400/30">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Role</p>
              <div className="flex flex-wrap gap-1">
                {ROLES.map((r) => (
                  <button key={r} onClick={() => { roleMut.mutate(r); setOpen(false); }}
                    className={cn('rounded px-2 py-0.5 text-[10px] font-medium transition-colors', user.role === r ? 'bg-brand-600/30 text-brand-300' : 'text-slate-400 hover:text-slate-200')}>
                    {r.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <button onClick={() => { setShowJourney(true); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:bg-surface-300 hover:text-slate-200 transition-colors">
                <Activity className="h-3.5 w-3.5" />
                View activation journey
              </button>
              <button onClick={() => { impMut.mutate(); setOpen(false); }} disabled={impMut.isPending}
                className="flex items-center gap-2 px-3 py-2 text-xs text-brand-400 hover:bg-brand-600/10 transition-colors">
                <UserCheck className="h-3.5 w-3.5" />
                {impMut.isPending ? 'Starting…' : 'Impersonate user'}
              </button>
              <button onClick={() => { setTrialEdit(true); setTrialDate(user.trialEndsAt?.slice(0, 10) ?? ''); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:bg-surface-300 hover:text-slate-200 transition-colors">
                <CalendarDays className="h-3.5 w-3.5" />
                Set trial end date
              </button>
              <button onClick={() => resetMut.mutate()} disabled={resetMut.isPending}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:bg-surface-300 hover:text-slate-200 transition-colors">
                <KeyRound className="h-3.5 w-3.5" />
                {resetMut.isPending ? 'Sending…' : resetMut.isSuccess ? 'Email sent ✓' : 'Send password reset'}
              </button>
              <button onClick={() => { activeMut.mutate(!user.isActive); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:bg-surface-300 hover:text-slate-200 transition-colors">
                {user.isActive
                  ? <><PowerOff className="h-3.5 w-3.5 text-warning" />Deactivate account</>
                  : <><Power className="h-3.5 w-3.5 text-success" />Reactivate account</>}
              </button>
              <button onClick={() => { setConfirm('delete'); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />Delete account + data
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}

      {showJourney && <JourneyModal user={user} secret={secret} onClose={() => setShowJourney(false)} />}
    </div>
  );
}

export function UsersTab({ secret }: { secret: string }) {
  const [search, setSearch] = useState('');
  const [planFilter, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const debouncedSearch = useMemo(() => {
    let t: ReturnType<typeof setTimeout>;
    return (v: string) => { clearTimeout(t); t = setTimeout(() => { setSearch(v); setPage(1); }, 300); };
  }, []);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin', 'users', secret, search, planFilter, page],
    queryFn: () => adminService.getUsers(secret, { search, plan: planFilter, page }),
    enabled: !!secret,
  });

  const users = usersData?.users ?? [];
  const total = usersData?.total ?? 0;
  const pages = usersData?.pages ?? 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input type="text" placeholder="Search by name or email…" onChange={(e) => debouncedSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-surface-400/40 bg-surface-200 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none" />
        </div>
        <div className="flex rounded-lg border border-surface-400/30 bg-surface-200/30 p-0.5">
          {['', ...PLANS].map((p) => (
            <button key={p} onClick={() => { setPlan(p); setPage(1); }}
              className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', planFilter === p ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40' : 'text-slate-500 hover:text-slate-300')}>
              {p || 'All'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600">{total} user{total !== 1 ? 's' : ''}</p>
      </div>

      <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-400/30 bg-surface-200/50">
              {['Name', 'Email', 'Plan', 'Role', 'Data', 'Status', 'Joined', 'Last login', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-400/20">
            {isLoading ? (
              <tr><td colSpan={9} className="py-12 text-center text-xs text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-xs text-slate-500">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className={cn('hover:bg-surface-200/40 transition-colors', !u.isActive && 'opacity-50')}>
                <td className="px-4 py-3"><p className="text-xs font-medium text-slate-200">{u.firstName} {u.lastName}</p></td>
                <td className="px-4 py-3">
                  <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {u.emailVerifiedAt ? <span className="text-[10px] text-success">✓ verified</span> : <span className="text-[10px] text-slate-600">unverified</span>}
                    {u.mfaEnabled && <span className="text-[10px] text-brand-400">· MFA</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', PLAN_COLORS[u.plan] ?? 'text-slate-400')}>{u.plan}</span>
                  {u.trialEndsAt && new Date(u.trialEndsAt) > new Date() && (
                    <p className="mt-0.5 text-[10px] text-amber-400">trial</p>
                  )}
                </td>
                <td className="px-4 py-3"><span className="text-xs text-slate-400">{u.role.replace('_', ' ')}</span></td>
                <td className="px-4 py-3"><p className="text-xs text-slate-500 tabular-nums">{u._count.ownedProperties}p · {u._count.ownedLeases}l · {u._count.ownedTenants}t</p></td>
                <td className="px-4 py-3">
                  {u.isActive ? <span className="text-[11px] font-medium text-success">Active</span> : <span className="text-[11px] font-medium text-danger">Suspended</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(u.createdAt)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(u.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  <UserActions user={u} secret={secret} onDone={() => qc.invalidateQueries({ queryKey: ['admin', 'users'] })} />
                </td>
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
