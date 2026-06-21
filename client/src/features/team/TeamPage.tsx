import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Shield, Crown, Eye, BarChart3, MoreVertical, UserCheck, UserX,
  UserPlus, X, Copy, Check, Clock, Link as LinkIcon,
} from 'lucide-react';
import { usersService, type TeamMember, type UserRole, type Invite } from '@/services/users.service';
import { useAuthStore } from '@/state/auth.store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';


const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-danger',    icon: Crown    },
  ADMIN:       { label: 'Admin',       color: 'text-warning',   icon: Shield   },
  ANALYST:     { label: 'Analyst',     color: 'text-brand-400', icon: BarChart3 },
  VIEWER:      { label: 'Viewer',      color: 'text-slate-400', icon: Eye      },
};

const ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER'];
const INVITE_ROLE_OPTIONS = [
  { value: 'ADMIN',   label: 'Admin'   },
  { value: 'ANALYST', label: 'Analyst' },
  { value: 'VIEWER',  label: 'Viewer'  },
];

function roleLevel(r: UserRole) { return ROLES.indexOf(r); }

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}


function Avatar({ member }: { member: TeamMember }) {
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  const colors = ['bg-brand-600', 'bg-purple-600', 'bg-teal-600', 'bg-orange-600'];
  const color = colors[member.firstName.charCodeAt(0) % colors.length];
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-fg`}>
      {initials}
    </div>
  );
}


function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-surface-400/40 bg-surface-200 hover:bg-surface-300 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}


function RolePicker({
  member, currentUserRole, onSelect, busy,
}: {
  member: TeamMember; currentUserRole: UserRole; onSelect: (role: UserRole) => void; busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const canChange = (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN')
    && roleLevel(currentUserRole) < roleLevel(member.role);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!canChange) {
    const cfg = ROLE_CONFIG[member.role];
    return (
      <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
        <cfg.icon className="h-3.5 w-3.5" />
        {cfg.label}
      </div>
    );
  }

  const cfg = ROLE_CONFIG[member.role];

  return (
    <div>
      <button
        ref={triggerRef}
        onClick={openDropdown}
        disabled={busy}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
      >
        <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        <span className={cfg.color}>{cfg.label}</span>
        <MoreVertical className="h-3 w-3 text-slate-600" />
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right }}
          className="z-50 min-w-[140px] rounded-lg border border-surface-400/60 bg-surface-100 py-1 shadow-xl"
        >
          {ROLES
            .filter((r) => r !== member.role && roleLevel(r) > roleLevel(currentUserRole))
            .map((r) => {
              const rcfg = ROLE_CONFIG[r];
              return (
                <button
                  key={r}
                  onClick={() => { onSelect(r); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-surface-200 transition-colors ${rcfg.color}`}
                >
                  <rcfg.icon className="h-3.5 w-3.5" />
                  {rcfg.label}
                </button>
              );
            })}
        </div>,
        document.body,
      )}
    </div>
  );
}


function MemberRow({ member, currentUserId, currentUserRole }: {
  member: TeamMember; currentUserId: string; currentUserRole: UserRole;
}) {
  const qc = useQueryClient();
  const isMe = member.id === currentUserId;
  const canManage = (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN') && !isMe;

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) => usersService.updateRole(member.id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const activeMutation = useMutation({
    mutationFn: (isActive: boolean) => usersService.setActive(member.id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const lastLogin = member.lastLoginAt
    ? new Date(member.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Never';

  return (
    <tr className={`border-b border-surface-400/30 hover:bg-surface-200/30 transition-colors ${!member.isActive ? 'opacity-50' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar member={member} />
          <div>
            <p className="text-sm font-medium text-slate-200">
              {member.firstName} {member.lastName}
              {isMe && <span className="ml-1.5 text-[10px] text-brand-400 font-normal">(you)</span>}
            </p>
            <p className="text-xs text-slate-500">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RolePicker member={member} currentUserRole={currentUserRole} onSelect={(r) => roleMutation.mutate(r)} busy={roleMutation.isPending} />
      </td>
      <td className="px-4 py-3">
        <Badge variant={member.isActive ? 'success' : 'neutral'}>{member.isActive ? 'Active' : 'Inactive'}</Badge>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{lastLogin}</td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="px-4 py-3">
        {canManage && (
          <button
            onClick={() => activeMutation.mutate(!member.isActive)}
            disabled={activeMutation.isPending}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              member.isActive
                ? 'text-slate-500 hover:text-danger hover:bg-danger/10'
                : 'text-slate-500 hover:text-success hover:bg-success/10'
            }`}
          >
            {member.isActive
              ? <><UserX className="h-3.5 w-3.5" />Deactivate</>
              : <><UserCheck className="h-3.5 w-3.5" />Activate</>}
          </button>
        )}
      </td>
    </tr>
  );
}


function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('ANALYST');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => usersService.createInvite(email.trim(), role),
    onSuccess: (invite) => {
      setCreatedToken(invite.token);
      void qc.invalidateQueries({ queryKey: ['invites'] });
    },
    onError: (err: Error) => setError(err.message || 'Failed to create invite'),
  });

  const inviteLink = createdToken
    ? `${window.location.origin}/auth/invite/${createdToken}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl border border-surface-400/40 bg-surface-100 p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">
            {createdToken ? 'Invite link ready' : 'Invite a team member'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!createdToken ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email address</label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && email && createMutation.mutate()}
                placeholder="colleague@company.com"
                className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Role</label>
              <Select
                value={role}
                onChange={(v) => setRole(v as UserRole)}
                options={INVITE_ROLE_OPTIONS}
              />
            </div>
            {error && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                loading={createMutation.isPending}
                disabled={!email.trim()}
                onClick={() => createMutation.mutate()}
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Generate invite link
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl bg-success/10 border border-success/20 px-4 py-3">
              <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-success">Invite created</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  For <span className="text-slate-300">{email}</span> as{' '}
                  <span className="text-slate-300">{ROLE_CONFIG[role]?.label}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Share this link</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-lg border border-surface-400/40 bg-surface-200/60 px-3 py-2">
                  <p className="text-xs text-slate-400 truncate font-mono">{inviteLink}</p>
                </div>
                <CopyButton text={inviteLink} />
              </div>
              <p className="text-[11px] text-slate-600">Expires in 7 days. Send this link directly to the person you're inviting.</p>
            </div>

            <div className="flex justify-end mt-1">
              <Button size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pending invites ──────────────────────────────────────────────────────────

function PendingInvites({ currentUserRole }: { currentUserRole: UserRole }) {
  const qc = useQueryClient();
  const canManage = currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN';

  const { data: invites = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: usersService.listInvites,
    enabled: canManage,
    staleTime: 30_000,
  });

  const revokeMutation = useMutation({
    mutationFn: usersService.revokeInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });

  if (!canManage || invites.length === 0) return null;

  return (
    <Card>
      <div className="px-4 py-3 border-b border-surface-400/30 flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-medium text-slate-300">Pending Invites</h3>
        <span className="text-xs text-slate-600">({invites.length})</span>
      </div>
      <div className="divide-y divide-surface-400/20">
        {invites.map((invite: Invite) => {
          const days = daysUntil(invite.expiresAt);
          const link = `${window.location.origin}/auth/invite/${invite.token}`;
          const cfg = ROLE_CONFIG[invite.role];
          return (
            <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-300 truncate">{invite.email}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Invited by {invite.invitedBy.firstName} {invite.invitedBy.lastName}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${cfg.color}`}>
                <cfg.icon className="h-3.5 w-3.5" />
                {cfg.label}
              </div>
              <span className={`text-xs shrink-0 ${days <= 1 ? 'text-danger' : days <= 3 ? 'text-warning' : 'text-slate-500'}`}>
                {days === 0 ? 'Expires today' : `${days}d left`}
              </span>
              <CopyButton text={link} label="Copy link" />
              <button
                onClick={() => revokeMutation.mutate(invite.id)}
                disabled={revokeMutation.isPending}
                className="text-xs text-slate-600 hover:text-danger transition-colors shrink-0"
              >
                Revoke
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const currentUser = useAuthStore((s) => s.user);
  const currentUserRole = (currentUser?.role as UserRole) ?? 'VIEWER';
  const canInvite = currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN';
  const [showInvite, setShowInvite] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.listUsers,
  });

  const byRole: Record<UserRole, TeamMember[]> = { SUPER_ADMIN: [], ADMIN: [], ANALYST: [], VIEWER: [] };
  for (const m of members) byRole[m.role]?.push(m);
  const activeCount = members.filter((m) => m.isActive).length;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Team"
        description={`${activeCount} active member${activeCount !== 1 ? 's' : ''}`}
        actions={
          canInvite ? (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4" />
              Invite member
            </Button>
          ) : undefined
        }
      />

      {/* Role summary */}
      <div className="flex flex-wrap gap-3">
        {ROLES.map((r) => {
          const cfg = ROLE_CONFIG[r];
          const count = byRole[r].length;
          if (count === 0) return null;
          return (
            <div key={r} className="flex items-center gap-2 rounded-lg border border-surface-400/40 bg-surface-50 px-3 py-2">
              <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
              <span className={`text-sm font-bold ${cfg.color}`}>{count}</span>
              <span className="text-xs text-slate-500">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Member table */}
      <Card>
        {isLoading ? (
          <PageLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {['Member', 'Role', 'Status', 'Last Login', 'Joined', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    currentUserId={currentUser?.id ?? ''}
                    currentUserRole={currentUserRole}
                  />
                ))}
              </tbody>
            </table>
            {members.length === 0 && (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No team members yet</p>
                {canInvite && (
                  <button
                    onClick={() => setShowInvite(true)}
                    className="mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Invite the first team member →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Pending invites */}
      <PendingInvites currentUserRole={currentUserRole} />

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
