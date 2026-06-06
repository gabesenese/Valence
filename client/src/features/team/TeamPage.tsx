import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Shield, Crown, Eye, BarChart3, MoreVertical, UserCheck, UserX } from 'lucide-react';
import { usersService, type TeamMember, type UserRole } from '@/services/users.service';
import { useAuthStore } from '@/state/auth.store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-danger',   icon: Crown   },
  ADMIN:       { label: 'Admin',       color: 'text-warning',  icon: Shield  },
  ANALYST:     { label: 'Analyst',     color: 'text-brand-400',icon: BarChart3},
  VIEWER:      { label: 'Viewer',      color: 'text-slate-400',icon: Eye     },
};

const ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER'];

function roleLevel(r: UserRole) {
  return ROLES.indexOf(r);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ member }: { member: TeamMember }) {
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  const colors = ['bg-brand-600', 'bg-purple-600', 'bg-teal-600', 'bg-orange-600'];
  const color = colors[member.firstName.charCodeAt(0) % colors.length];
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}>
      {initials}
    </div>
  );
}

// ─── Role picker ──────────────────────────────────────────────────────────────

function RolePicker({
  member,
  currentUserRole,
  onSelect,
  busy,
}: {
  member: TeamMember;
  currentUserRole: UserRole;
  onSelect: (role: UserRole) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const canChange = roleLevel(currentUserRole) > roleLevel(member.role) ||
    currentUserRole === 'SUPER_ADMIN';

  if (!canChange) {
    const cfg = ROLE_CONFIG[member.role];
    const Icon = cfg.icon;
    return (
      <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
        <Icon className="h-3.5 w-3.5" />
        {cfg.label}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={busy}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
      >
        {(() => {
          const cfg = ROLE_CONFIG[member.role];
          const Icon = cfg.icon;
          return (
            <>
              <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              <span className={cfg.color}>{cfg.label}</span>
              <MoreVertical className="h-3 w-3 text-slate-600" />
            </>
          );
        })()}
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-20 min-w-[140px] rounded-lg border border-surface-400/60 bg-surface-100 py-1 shadow-xl">
          {ROLES.filter((r) => r !== member.role && roleLevel(currentUserRole) > roleLevel(r) || currentUserRole === 'SUPER_ADMIN').map((r) => {
            if (r === member.role) return null;
            const cfg = ROLE_CONFIG[r];
            const Icon = cfg.icon;
            return (
              <button
                key={r}
                onClick={() => { onSelect(r); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-surface-200 transition-colors ${cfg.color}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  currentUserId,
  currentUserRole,
}: {
  member: TeamMember;
  currentUserId: string;
  currentUserRole: UserRole;
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
        <RolePicker
          member={member}
          currentUserRole={currentUserRole}
          onSelect={(r) => roleMutation.mutate(r)}
          busy={roleMutation.isPending}
        />
      </td>
      <td className="px-4 py-3">
        <Badge variant={member.isActive ? 'success' : 'neutral'}>
          {member.isActive ? 'Active' : 'Inactive'}
        </Badge>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.listUsers,
  });

  const byRole: Record<UserRole, TeamMember[]> = {
    SUPER_ADMIN: [],
    ADMIN: [],
    ANALYST: [],
    VIEWER: [],
  };
  for (const m of members) byRole[m.role]?.push(m);

  const activeCount = members.filter((m) => m.isActive).length;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Team</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {activeCount} active member{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Role summary */}
      <div className="flex flex-wrap gap-3">
        {ROLES.map((r) => {
          const cfg = ROLE_CONFIG[r];
          const Icon = cfg.icon;
          const count = byRole[r].length;
          if (count === 0) return null;
          return (
            <div key={r} className="flex items-center gap-2 rounded-lg border border-surface-400/40 bg-surface-50 px-3 py-2">
              <Icon className={`h-4 w-4 ${cfg.color}`} />
              <span className={`text-sm font-bold ${cfg.color}`}>{count}</span>
              <span className="text-xs text-slate-500">{cfg.label}</span>
            </div>
          );
        })}
      </div>

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
                    currentUserRole={(currentUser?.role as UserRole) ?? 'VIEWER'}
                  />
                ))}
              </tbody>
            </table>
            {members.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No team members yet</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
