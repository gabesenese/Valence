import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Globe, Users, Crown, Shield, BarChart3, Eye,
  UserPlus, X, Copy, Check, Clock, Link as LinkIcon, AlertTriangle,
  CheckCircle2, Loader2, MoreVertical, UserX, FileText, Activity, Cpu,
} from 'lucide-react';
import { organizationService } from '@/services/organization.service';
import { usersService, type TeamMember, type UserRole, type Invite } from '@/services/users.service';
import { propertiesService } from '@/services/properties.service';
import { leasesService } from '@/services/leases.service';
import { tasksService } from '@/services/tasks.service';
import { auditService, type AuditLogEntry } from '@/services/audit.service';
import { useAuthStore } from '@/state/auth.store';
import { authService } from '@/services/auth.service';
import { usePlan } from '@/hooks/usePlan';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';


const INDUSTRY_OPTIONS = [
  { value: '', label: 'Select industry' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Commercial Real Estate', label: 'Commercial Real Estate' },
  { value: 'Residential Real Estate', label: 'Residential Real Estate' },
  { value: 'Property Management', label: 'Property Management' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Industrial', label: 'Industrial' },
  { value: 'Office', label: 'Office' },
  { value: 'Mixed Use', label: 'Mixed Use' },
  { value: 'Hospitality', label: 'Hospitality' },
  { value: 'Other', label: 'Other' },
];

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC — Coordinated Universal Time' },
  { value: 'America/New_York', label: 'EST/EDT — New York' },
  { value: 'America/Chicago', label: 'CST/CDT — Chicago' },
  { value: 'America/Denver', label: 'MST/MDT — Denver' },
  { value: 'America/Los_Angeles', label: 'PST/PDT — Los Angeles' },
  { value: 'America/Toronto', label: 'EST/EDT — Toronto' },
  { value: 'America/Vancouver', label: 'PST/PDT — Vancouver' },
  { value: 'America/Sao_Paulo', label: 'BRT — São Paulo' },
  { value: 'Europe/London', label: 'GMT/BST — London' },
  { value: 'Europe/Paris', label: 'CET/CEST — Paris' },
  { value: 'Europe/Berlin', label: 'CET/CEST — Berlin' },
  { value: 'Europe/Amsterdam', label: 'CET/CEST — Amsterdam' },
  { value: 'Asia/Dubai', label: 'GST — Dubai' },
  { value: 'Asia/Kolkata', label: 'IST — Mumbai/Delhi' },
  { value: 'Asia/Singapore', label: 'SGT — Singapore' },
  { value: 'Asia/Shanghai', label: 'CST — Shanghai' },
  { value: 'Asia/Tokyo', label: 'JST — Tokyo' },
  { value: 'Australia/Sydney', label: 'AEST/AEDT — Sydney' },
  { value: 'Pacific/Auckland', label: 'NZST/NZDT — Auckland' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar' },
];

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUPER_ADMIN: { label: 'Owner',   color: 'text-warning',   icon: Crown     },
  ADMIN:       { label: 'Admin',   color: 'text-brand-400', icon: Shield    },
  ANALYST:     { label: 'Analyst', color: 'text-teal-400',  icon: BarChart3 },
  VIEWER:      { label: 'Viewer',  color: 'text-slate-400', icon: Eye       },
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

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function describeActivity(entry: AuditLogEntry): string {
  const name = entry.entityName ? ` "${entry.entityName}"` : ` ${entry.entity}`;
  switch (entry.action) {
    case 'CREATE':      return `created${name}`;
    case 'UPDATE':      return `updated${name}`;
    case 'DELETE':      return `deleted${name}`;
    case 'IMPORT':      return `imported ${entry.entity}s`;
    case 'ROLE_CHANGE': return `changed a team member's role`;
    case 'PLAN_CHANGE': return `changed the organization plan`;
    default:            return `${entry.action.toLowerCase().replace(/_/g, ' ')}${name}`;
  }
}


function MemberAvatar({ member }: { member: TeamMember }) {
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
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1 rounded-md border border-surface-400/40 bg-surface-200 hover:bg-surface-300 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}


function OrgHeroCard({ members }: {
  members: TeamMember[];
}) {
  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: organizationService.getOrganization,
    staleTime: 60_000,
  });
  const { data: propertiesPage } = useQuery({
    queryKey: ['org-stats', 'properties'],
    queryFn: () => propertiesService.getProperties({ limit: 1 }),
    staleTime: 5 * 60_000,
  });
  const { data: leasesPage } = useQuery({
    queryKey: ['org-stats', 'leases'],
    queryFn: () => leasesService.getLeases({ limit: 1 }),
    staleTime: 5 * 60_000,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksService.getAll(),
    staleTime: 5 * 60_000,
  });
  const { label: planLabel } = usePlan();

  const activeCount = members.filter((m) => m.isActive).length;
  const propertyCount = propertiesPage?.meta.total ?? 0;
  const leaseCount = leasesPage?.meta.total ?? 0;
  const openTaskCount = tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;

  return (
    <Card>
      <CardBody className="py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 border border-brand-500/20">
              <Building2 className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-fg">{org?.name ?? '—'}</h2>
                <span className="rounded-full border border-brand-500/30 bg-brand-600/10 px-2 py-0.5 text-[10px] font-semibold text-brand-400 uppercase tracking-wide">
                  {planLabel}
                </span>
              </div>
              {org?.industry && <p className="text-xs text-slate-500 mt-0.5">{org.industry}</p>}

              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-semibold text-slate-200">{activeCount}</span> members
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-semibold text-slate-200">{propertyCount}</span> properties
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="font-semibold text-slate-200">{leaseCount}</span> leases
                </span>
                {openTaskCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="font-semibold text-slate-200">{openTaskCount}</span> open tasks
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </CardBody>
    </Card>
  );
}


function RolePicker({ member, currentUserRole, onSelect, busy }: {
  member: TeamMember; currentUserRole: UserRole; onSelect: (role: UserRole) => void; busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const canChange = (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN')
    && roleLevel(currentUserRole) < roleLevel(member.role);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  const cfg = ROLE_CONFIG[member.role];
  if (!canChange) {
    return (
      <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
        <cfg.icon className="h-3.5 w-3.5" />
        {cfg.label}
      </div>
    );
  }

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
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left }}
          className="z-50 min-w-[140px] rounded-lg border border-surface-400/60 bg-surface-100 py-1 shadow-xl"
        >
          {ROLES
            .filter((r) => r !== member.role && roleLevel(r) > roleLevel(currentUserRole))
            .map((r) => {
              const c = ROLE_CONFIG[r];
              return (
                <button
                  key={r}
                  onClick={() => { onSelect(r); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-surface-200 transition-colors ${c.color}`}
                >
                  <c.icon className="h-3.5 w-3.5" />
                  {c.label}
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
  const isOwner = member.role === 'SUPER_ADMIN';
  const canManage = (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN') && !isMe && !isOwner;

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) => usersService.updateRole(member.id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const removeMutation = useMutation({
    mutationFn: () => usersService.setActive(member.id, false),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className={`flex items-center gap-4 px-5 py-4 border-b border-surface-400/30 last:border-0 hover:bg-surface-200/30 transition-colors group ${!member.isActive ? 'opacity-50' : ''}`}>
      <MemberAvatar member={member} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">
          {member.firstName} {member.lastName}
          {isMe && <span className="ml-1.5 text-[10px] text-brand-400 font-normal">(you)</span>}
        </p>
        <p className="text-xs text-slate-500 truncate">{member.email}</p>
      </div>

      <div className="shrink-0">
        <RolePicker
          member={member}
          currentUserRole={currentUserRole}
          onSelect={(r) => roleMutation.mutate(r)}
          busy={roleMutation.isPending}
        />
      </div>

      <span className="hidden text-xs text-slate-500 shrink-0 w-24 text-right tabular-nums sm:block">
        {timeAgo(member.lastLoginAt)}
      </span>

      <div className="hidden shrink-0 sm:block">
        <Badge variant={member.isActive ? 'success' : 'neutral'}>
          {member.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="shrink-0 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
        {canManage && member.isActive && (
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="text-slate-600 hover:text-danger transition-colors"
            title="Remove member"
          >
            {removeMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <UserX className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
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
    onSuccess: (invite) => { setCreatedToken(invite.token); void qc.invalidateQueries({ queryKey: ['invites'] }); },
    onError: (err: Error) => setError(err.message || 'Failed to create invite'),
  });

  const inviteLink = createdToken ? `${window.location.origin}/auth/invite/${createdToken}` : '';

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
              <Select value={role} onChange={(v) => setRole(v as UserRole)} options={INVITE_ROLE_OPTIONS} />
            </div>
            {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" loading={createMutation.isPending} disabled={!email.trim()} onClick={() => createMutation.mutate()}>
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

// ─── Team section ─────────────────────────────────────────────────────────────

function TeamSection({ onInvite, canInvite }: { onInvite: () => void; canInvite: boolean }) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserRole = (currentUser?.role as UserRole) ?? 'VIEWER';

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.listUsers,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: usersService.listInvites,
    enabled: canInvite,
    staleTime: 30_000,
  });

  const revokeMutation = useMutation({
    mutationFn: usersService.revokeInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });

  const activeCount = members.filter((m) => m.isActive).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-400" />
          <CardTitle>Team Members</CardTitle>
          <span className="text-xs text-slate-600">{activeCount} active</span>
        </div>
      </CardHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-surface-400 border-t-brand-400" />
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-sm text-slate-500">No team members yet</p>
          {canInvite && (
            <button onClick={onInvite} className="mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors">
              Invite the first team member →
            </button>
          )}
        </div>
      ) : (
        <div>
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              currentUserId={currentUser?.id ?? ''}
              currentUserRole={currentUserRole}
            />
          ))}
        </div>
      )}

      {/* Pending invites — embedded at the bottom */}
      {canInvite && invites.length > 0 && (
        <>
          <div className="flex items-center gap-2 border-t border-surface-400/30 px-5 py-2.5 bg-surface-100/40">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-500">Pending Invitations</span>
            <span className="text-xs text-slate-600">({invites.length})</span>
          </div>
          <div className="divide-y divide-surface-400/20">
            {invites.map((invite: Invite) => {
              const days = daysUntil(invite.expiresAt);
              const link = `${window.location.origin}/auth/invite/${invite.token}`;
              const cfg = ROLE_CONFIG[invite.role];
              return (
                <div key={invite.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">{invite.email}</p>
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
                  <CopyButton text={link} label="Resend" />
                  <button
                    onClick={() => revokeMutation.mutate(invite.id)}
                    disabled={revokeMutation.isPending}
                    className="text-xs text-slate-600 hover:text-danger transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Team activity ────────────────────────────────────────────────────────────

function TeamActivityCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => auditService.list({ limit: 10 }),
    staleTime: 60_000,
  });

  if (isLoading || !data?.data.length) return null;

  const colors = ['bg-brand-600', 'bg-purple-600', 'bg-teal-600', 'bg-orange-600'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          <CardTitle>Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <div>
        {data.data.map((entry) => {
          const actor = entry.user;
          const avatarColor = actor ? colors[actor.firstName.charCodeAt(0) % colors.length] : 'bg-surface-400';
          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-5 py-3 border-b border-surface-400/20 last:border-0 hover:bg-surface-200/20 transition-colors"
            >
              {actor ? (
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${avatarColor} text-[10px] font-bold text-fg`}>
                  {actor.firstName[0]}{actor.lastName[0]}
                </div>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-300">
                  <Cpu className="h-3.5 w-3.5 text-slate-500" />
                </div>
              )}
              <p className="flex-1 min-w-0 text-xs text-slate-400 truncate">
                <span className="font-medium text-slate-200">
                  {actor ? `${actor.firstName} ${actor.lastName}` : 'System'}
                </span>
                {' '}{describeActivity(entry)}
              </p>
              <span className="text-xs text-slate-600 shrink-0 tabular-nums">{timeAgo(entry.createdAt)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Org settings (compact read + inline edit) ────────────────────────────────

function OrgSettingsCard() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const [editing, setEditing] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: organizationService.getOrganization,
    staleTime: 60_000,
  });

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [currency, setCurrency] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (org) {
      setName(org.name);
      setIndustry(org.industry ?? '');
      setTimezone(org.timezone);
      setCurrency(org.currency);
    }
  }, [org]);

  const save = async () => {
    if (!name.trim()) { setError('Organization name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await organizationService.updateOrganization({ name: name.trim(), industry: industry || null, timezone, currency });
      void qc.invalidateQueries({ queryKey: ['organization'] });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-slate-500" />
            <CardTitle>Organization Settings</CardTitle>
          </div>
          {canEdit && !editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </CardHeader>

        {!editing ? (
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Name</p>
                <p className="text-sm text-slate-200">{org?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Industry</p>
                <p className="text-sm text-slate-200">{org?.industry || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Currency · Timezone</p>
                <p className="text-sm text-slate-200">{org?.currency || '—'} · {org?.timezone?.split('/')[1]?.replace(/_/g, ' ') ?? org?.timezone ?? '—'}</p>
              </div>
            </div>
            {saved && (
              <p className="mt-3 flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </p>
            )}
          </CardBody>
        ) : (
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Organization Name</label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Property Group"
                className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Industry</label>
                <Select value={industry} onChange={setIndustry} options={INDUSTRY_OPTIONS} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Currency</label>
                <Select value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Timezone</label>
              <Select value={timezone} onChange={setTimezone} options={TIMEZONE_OPTIONS} />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} loading={saving}>Save changes</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setError(''); }}>Cancel</Button>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

// ─── Transfer ownership modal ─────────────────────────────────────────────────

function TransferOwnershipModal({ members, onClose, onSuccess }: {
  members: TeamMember[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const transferMutation = useMutation({
    mutationFn: () => organizationService.transferOwnership(selectedId),
    onSuccess,
    onError: (err: Error) => setError(err.message || 'Transfer failed'),
  });

  const eligible = members.filter((m) => m.isActive && m.role !== 'SUPER_ADMIN');
  const selectedMember = eligible.find((m) => m.id === selectedId);
  const memberOptions = [
    { value: '', label: 'Select a member...' },
    ...eligible.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName} (${ROLE_CONFIG[m.role].label})` })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-surface-100 p-6 shadow-xl mx-4">
        <div className="flex items-start gap-3 mb-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 border border-danger/20">
            <Crown className="h-4 w-4 text-danger" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-fg">Transfer Ownership</h2>
            <p className="text-xs text-slate-500 mt-0.5">This cannot be undone. You will become an Admin.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Transfer to</label>
            <Select value={selectedId} onChange={setSelectedId} options={memberOptions} />
          </div>
          {selectedMember && (
            <div className="rounded-xl border border-surface-400/40 bg-surface-200/50 px-4 py-3 flex items-center gap-3">
              <MemberAvatar member={selectedMember} />
              <div>
                <p className="text-sm font-semibold text-fg">{selectedMember.firstName} {selectedMember.lastName}</p>
                <p className="text-xs text-slate-500">{selectedMember.email}</p>
              </div>
            </div>
          )}
          {selectedId && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-surface-400 accent-danger"
              />
              <span className="text-xs text-slate-400">
                I understand that <strong className="text-slate-200">{selectedMember?.firstName} {selectedMember?.lastName}</strong> will
                become the new Owner and I will be downgraded to Admin.
              </span>
            </label>
          )}
          {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              loading={transferMutation.isPending}
              disabled={!selectedId || !confirmed}
              onClick={() => transferMutation.mutate()}
              className="bg-danger/80 hover:bg-danger border-danger/50 text-white"
            >
              Transfer ownership
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

function DangerZone({ members }: { members: TeamMember[] }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [showModal, setShowModal] = useState(false);
  const [transferred, setTransferred] = useState(false);

  const handleTransferSuccess = async () => {
    setShowModal(false);
    setTransferred(true);
    setTimeout(async () => {
      try { if (refreshToken) await authService.logout(refreshToken); }
      finally { logout(); navigate('/auth/login'); }
    }, 2500);
  };

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <CardTitle>Danger Zone</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-4">
            <p className="text-sm font-semibold text-fg">Transfer Ownership</p>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              Permanently transfers owner access to another team member. You will be downgraded to Admin
              and signed out immediately. This action cannot be undone.
            </p>
            {transferred ? (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ownership transferred. Signing you out…
              </span>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                disabled={members.filter((m) => m.isActive && m.role !== 'SUPER_ADMIN').length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 hover:bg-danger/20 px-3 py-1.5 text-xs font-semibold text-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Crown className="h-3.5 w-3.5" />
                Transfer ownership…
              </button>
            )}
          </div>
        </CardBody>
      </Card>
      {showModal && (
        <TransferOwnershipModal
          members={members}
          onClose={() => setShowModal(false)}
          onSuccess={() => void handleTransferSuccess()}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizationPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isOwner = currentUser?.role === 'SUPER_ADMIN';
  const canInvite = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const [showInvite, setShowInvite] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.listUsers,
  });

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Organization"
        description="Team management and workspace settings"
        actions={
          canInvite ? (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Invite member
            </Button>
          ) : undefined
        }
      />

      {/* Hero — org name, real stats, owner */}
      <OrgHeroCard members={members} />

      {/* Team members + pending invites — primary content, full width */}
      <TeamSection onInvite={() => setShowInvite(true)} canInvite={canInvite} />

      {/* Recent team activity — full width */}
      <TeamActivityCard />

      {/* Settings — compact, secondary */}
      <OrgSettingsCard />

      {/* Danger zone — owner only */}
      {isOwner && <DangerZone members={members} />}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
