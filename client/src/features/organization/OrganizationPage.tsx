import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Globe, Users, Crown, Shield, BarChart3, Eye,
  UserPlus, X, Copy, Check, Clock, Link as LinkIcon, AlertTriangle,
  CheckCircle2, ChevronRight, ChevronDown, FileText,
  Activity, Cpu, CreditCard, Mail,
} from 'lucide-react';
import { organizationService } from '@/services/organization.service';
import { usersService, type TeamMember, type UserRole, type Invite } from '@/services/users.service';
import { propertiesService } from '@/services/properties.service';
import { leasesService } from '@/services/leases.service';
import { tasksService } from '@/services/tasks.service';
import { auditService, type AuditLogEntry } from '@/services/audit.service';
import { billingService } from '@/services/billing.service';
import { useAuthStore } from '@/state/auth.store';
import { authService } from '@/services/auth.service';
import { usePlan } from '@/hooks/usePlan';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { WorkspaceShell, WorkspaceSection, type WorkspaceMeta } from '@/components/ui/WorkspaceShell';


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

const ROLE_CAPABILITIES: Record<UserRole, { can: string[]; cannot: string[] }> = {
  SUPER_ADMIN: {
    can: ['Full access to every workspace', 'Manage billing and plan', 'Manage team, roles and invites', 'Transfer ownership'],
    cannot: [],
  },
  ADMIN: {
    can: ['Manage team, roles and invites', 'Edit organization settings', 'Create and edit all records'],
    cannot: ['Manage billing', 'Transfer ownership'],
  },
  ANALYST: {
    can: ['Create and edit properties, leases and tasks', 'Review and resolve alerts'],
    cannot: ['Manage team or invites', 'Change organization settings'],
  },
  VIEWER: {
    can: ['View properties, leases and reports'],
    cannot: ['Create or edit records', 'Manage team or settings'],
  },
};

const ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER'];
const INVITE_ROLE_OPTIONS = [
  { value: 'ADMIN',   label: 'Admin'   },
  { value: 'ANALYST', label: 'Analyst' },
  { value: 'VIEWER',  label: 'Viewer'  },
];

const TASK_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function roleLevel(r: UserRole) { return ROLES.indexOf(r); }

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dayBucket(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return 'Today';
  if (t >= startOfToday - 86400000) return 'Yesterday';
  return 'Earlier';
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


function MemberAvatar({ member, size = 'md' }: { member: TeamMember; size?: 'sm' | 'md' }) {
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  const colors = ['bg-brand-600', 'bg-purple-600', 'bg-teal-600', 'bg-orange-600'];
  const color = colors[member.firstName.charCodeAt(0) % colors.length];
  const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-sm';
  return (
    <div className={`flex ${dim} shrink-0 items-center justify-center rounded-full ${color} font-bold text-fg`}>
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


function OrgSummary({ members }: { members: TeamMember[] }) {
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
  const owner = members.find((m) => m.role === 'SUPER_ADMIN');

  const stats = [
    { icon: Users, label: activeCount === 1 ? 'Member' : 'Members', value: activeCount },
    { icon: Building2, label: propertyCount === 1 ? 'Property' : 'Properties', value: propertyCount },
    { icon: FileText, label: leaseCount === 1 ? 'Lease' : 'Leases', value: leaseCount },
    { icon: Activity, label: 'Open tasks', value: openTaskCount },
  ];

  return (
    <Card>
      <CardBody className="py-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 border border-brand-500/20">
              <Building2 className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-fg">{org?.name ?? '—'}</h2>
                <span className="rounded-full border border-brand-500/30 bg-brand-600/10 px-2 py-0.5 text-[10px] font-semibold text-brand-400 uppercase tracking-wide">
                  {planLabel} Plan
                </span>
              </div>
              {org?.industry && <p className="mt-0.5 text-xs text-slate-500">{org.industry}</p>}
              {owner && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Crown className="h-3.5 w-3.5 text-warning" />
                  Owned by <span className="font-medium text-slate-300">{owner.firstName} {owner.lastName}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-5 sm:gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center sm:text-right">
                <p className="text-2xl font-bold tabular-nums text-fg">{s.value}</p>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}


function TodaysWork({ members, invites, onOpenMember }: {
  members: TeamMember[];
  invites: Invite[];
  onOpenMember: (id: string) => void;
}) {
  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: organizationService.getOrganization,
    staleTime: 60_000,
  });

  type WorkItem = { key: string; tone: string; text: string; sub: string; onClick: () => void };
  const items: WorkItem[] = [];

  invites.slice(0, 3).forEach((inv) => {
    const days = daysUntil(inv.expiresAt);
    items.push({
      key: `invite-${inv.id}`,
      tone: days <= 1 ? 'bg-danger' : 'bg-warning',
      text: `Invitation to ${inv.email} awaiting acceptance`,
      sub: days === 0 ? 'Expires today' : `${days}d left · ${ROLE_CONFIG[inv.role].label}`,
      onClick: () => scrollToId('invitations'),
    });
  });

  members
    .filter((m) => m.isActive && !m.lastLoginAt)
    .slice(0, 3)
    .forEach((m) => {
      items.push({
        key: `nologin-${m.id}`,
        tone: 'bg-warning',
        text: `${m.firstName} ${m.lastName} hasn't logged in yet`,
        sub: `Invited ${formatDate(m.createdAt)} · ${ROLE_CONFIG[m.role].label}`,
        onClick: () => onOpenMember(m.id),
      });
    });

  if (org && !org.industry) {
    items.push({
      key: 'profile',
      tone: 'bg-brand-500',
      text: 'Complete your organization profile',
      sub: 'Add your industry so reports are labelled correctly',
      onClick: () => scrollToId('settings'),
    });
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <CardTitle>Today's Work</CardTitle>
          <span className="text-xs text-slate-600">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
        </div>
      </CardHeader>
      <div>
        {items.map((it) => (
          <button
            key={it.key}
            onClick={it.onClick}
            className="group flex w-full items-center gap-3 border-b border-surface-400/20 px-5 py-3 text-left transition-colors last:border-0 hover:bg-surface-200/30"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${it.tone}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{it.text}</p>
              <p className="truncate text-xs text-slate-500">{it.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300" />
          </button>
        ))}
      </div>
    </Card>
  );
}


function InvitationsSection({ invites, canManage }: { invites: Invite[]; canManage: boolean }) {
  const qc = useQueryClient();
  const revokeMutation = useMutation({
    mutationFn: usersService.revokeInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });

  if (!canManage || invites.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning" />
          <CardTitle>Pending Invitations</CardTitle>
          <span className="text-xs text-slate-600">{invites.length}</span>
        </div>
      </CardHeader>
      <div id="invitations" className="scroll-mt-4">
        {invites.map((invite) => {
          const days = daysUntil(invite.expiresAt);
          const link = `${window.location.origin}/auth/invite/${invite.token}`;
          const cfg = ROLE_CONFIG[invite.role];
          return (
            <div key={invite.id} className="flex items-center gap-3 border-b border-surface-400/20 px-5 py-3.5 last:border-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-300/60">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">{invite.email}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Invited by {invite.invitedBy.firstName} {invite.invitedBy.lastName}
                </p>
              </div>
              <div className={`hidden items-center gap-1.5 text-xs font-medium shrink-0 sm:flex ${cfg.color}`}>
                <cfg.icon className="h-3.5 w-3.5" />
                {cfg.label}
              </div>
              <span className={`w-20 shrink-0 text-right text-xs ${days <= 1 ? 'text-danger' : days <= 3 ? 'text-warning' : 'text-slate-500'}`}>
                {days === 0 ? 'Expires today' : `${days}d left`}
              </span>
              <CopyButton text={link} label="Copy link" />
              <button
                onClick={() => revokeMutation.mutate(invite.id)}
                disabled={revokeMutation.isPending}
                className="shrink-0 text-xs text-slate-600 transition-colors hover:text-danger"
              >
                Cancel
              </button>
            </div>
          );
        })}
      </div>
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
      <div className={`flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
        <cfg.icon className="h-4 w-4" />
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
        className="flex items-center gap-1.5 rounded-lg border border-surface-400/50 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-surface-200"
      >
        <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
        <span className={cfg.color}>{cfg.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
      </button>
      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left }}
          className="z-[60] min-w-[150px] rounded-lg border border-surface-400/60 bg-surface-100 py-1 shadow-xl"
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


function MemberWorkspace({ member, currentUser, onClose }: {
  member: TeamMember | null;
  currentUser: { id: string; role: UserRole } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const open = !!member;

  const { data: tasks = [] } = useQuery({
    queryKey: ['member-tasks', member?.id],
    queryFn: () => tasksService.getAll({ assigneeUserId: member!.id, status: ['OPEN', 'IN_PROGRESS'] }),
    enabled: open,
    staleTime: 30_000,
  });
  const { data: activity } = useQuery({
    queryKey: ['member-activity', member?.id],
    queryFn: () => auditService.list({ userId: member!.id, limit: 5 }),
    enabled: open,
    staleTime: 30_000,
  });

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) => usersService.updateRole(member!.id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const activeMutation = useMutation({
    mutationFn: (next: boolean) => usersService.setActive(member!.id, next),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose(); },
  });

  if (!member) return <WorkspaceShell open={false} onClose={onClose} eyebrow="Team Member" title="">{null}</WorkspaceShell>;

  const currentRole = (currentUser?.role as UserRole) ?? 'VIEWER';
  const isMe = member.id === currentUser?.id;
  const isOwner = member.role === 'SUPER_ADMIN';
  const canManage = (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN') && !isMe && !isOwner;
  const caps = ROLE_CAPABILITIES[member.role];
  const cfg = ROLE_CONFIG[member.role];

  const meta: WorkspaceMeta[] = [
    { label: 'Role', value: cfg.label, tone: cfg.color },
    { label: 'Status', value: member.isActive ? 'Active' : 'Inactive', tone: member.isActive ? 'text-success' : 'text-slate-400' },
    { label: 'Last active', value: timeAgo(member.lastLoginAt) },
  ];

  const footer = canManage ? (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => activeMutation.mutate(!member.isActive)}
        disabled={activeMutation.isPending}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
          member.isActive
            ? 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20'
            : 'bg-brand-600 text-white hover:bg-brand-500'
        }`}
      >
        {activeMutation.isPending ? 'Working…' : member.isActive ? 'Deactivate member' : 'Reactivate member'}
      </button>
      {member.isActive && (
        <p className="text-center text-[11px] text-slate-600">
          Deactivating preserves their history and can be undone. Permanent removal isn't available yet.
        </p>
      )}
    </div>
  ) : undefined;

  return (
    <WorkspaceShell
      open={open}
      onClose={onClose}
      eyebrow="Team Member"
      title={`${member.firstName} ${member.lastName}${isMe ? ' (you)' : ''}`}
      subtitle={member.email}
      meta={meta}
      footer={footer}
    >
      <WorkspaceSection label="Profile">
        <p className="text-sm text-slate-300">{member.email}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Joined {formatDate(member.createdAt)} · Last active {timeAgo(member.lastLoginAt)}
        </p>
      </WorkspaceSection>

      <WorkspaceSection label="Role">
        {canManage ? (
          <RolePicker member={member} currentUserRole={currentRole} onSelect={(r) => roleMutation.mutate(r)} busy={roleMutation.isPending} />
        ) : (
          <div className={`flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
            <cfg.icon className="h-4 w-4" />
            {cfg.label}
            {isOwner && <span className="text-xs text-slate-500">· owner role can't be changed here</span>}
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection label="Permissions">
        <div className="flex flex-col gap-1.5">
          {caps.can.map((c) => (
            <span key={c} className="flex items-center gap-2 text-sm text-slate-300">
              <Check className="h-3.5 w-3.5 shrink-0 text-success" />{c}
            </span>
          ))}
          {caps.cannot.map((c) => (
            <span key={c} className="flex items-center gap-2 text-sm text-slate-600">
              <X className="h-3.5 w-3.5 shrink-0 text-slate-600" />{c}
            </span>
          ))}
        </div>
      </WorkspaceSection>

      <WorkspaceSection label={`Assigned tasks${tasks.length ? ` (${tasks.length})` : ''}`}>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">No open tasks assigned.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-sm text-slate-300">{t.title}</p>
                <span className="shrink-0 text-[11px] font-medium text-slate-500">{TASK_STATUS_LABEL[t.status] ?? t.status}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => { onClose(); navigate('/tasks'); }}
              className="group mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
            >
              View in Tasks
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection label="Recent activity">
        {!activity?.data.length ? (
          <p className="text-sm text-slate-500">No recent activity.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activity.data.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-sm text-slate-400">{describeActivity(entry)}</p>
                <span className="shrink-0 text-[11px] text-slate-600 tabular-nums">{timeAgo(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </WorkspaceSection>
    </WorkspaceShell>
  );
}


function MemberRow({ member, currentUserId, onOpen }: {
  member: TeamMember; currentUserId: string; onOpen: () => void;
}) {
  const isMe = member.id === currentUserId;
  const cfg = ROLE_CONFIG[member.role];
  return (
    <button
      onClick={onOpen}
      className={`group flex w-full items-center gap-4 border-b border-surface-400/30 px-5 py-4 text-left transition-colors last:border-0 hover:bg-surface-200/30 ${!member.isActive ? 'opacity-50' : ''}`}
    >
      <MemberAvatar member={member} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">
          {member.firstName} {member.lastName}
          {isMe && <span className="ml-1.5 text-[10px] font-normal text-brand-400">(you)</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{member.email}</p>
      </div>
      <div className={`hidden items-center gap-1.5 text-xs font-medium shrink-0 sm:flex ${cfg.color}`}>
        <cfg.icon className="h-3.5 w-3.5" />
        {cfg.label}
      </div>
      <span className="hidden w-24 shrink-0 text-right text-xs text-slate-500 tabular-nums md:block">
        {timeAgo(member.lastLoginAt)}
      </span>
      <div className="hidden shrink-0 sm:block">
        <Badge variant={member.isActive ? 'success' : 'neutral'}>
          {member.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300" />
    </button>
  );
}


function TeamSection({ members, isLoading, currentUserId, canInvite, onInvite, onOpenMember }: {
  members: TeamMember[];
  isLoading: boolean;
  currentUserId: string;
  canInvite: boolean;
  onInvite: () => void;
  onOpenMember: (id: string) => void;
}) {
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
          <Users className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-500">No team members yet</p>
          {canInvite && (
            <button onClick={onInvite} className="mt-3 text-xs text-brand-400 transition-colors hover:text-brand-300">
              Invite the first team member →
            </button>
          )}
        </div>
      ) : (
        <div>
          {members.map((m) => (
            <MemberRow key={m.id} member={m} currentUserId={currentUserId} onOpen={() => onOpenMember(m.id)} />
          ))}
        </div>
      )}
    </Card>
  );
}


function RecentActivity() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => auditService.list({ limit: 5 }),
    staleTime: 60_000,
  });

  if (isLoading || !data?.data.length) return null;

  const colors = ['bg-brand-600', 'bg-purple-600', 'bg-teal-600', 'bg-orange-600'];
  const buckets: Array<'Today' | 'Yesterday' | 'Earlier'> = ['Today', 'Yesterday', 'Earlier'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          <CardTitle>Recent Activity</CardTitle>
        </div>
        <button onClick={() => navigate('/audit')} className="text-xs font-medium text-brand-400 transition-colors hover:text-brand-300">
          View audit →
        </button>
      </CardHeader>
      <div>
        {buckets.map((bucket) => {
          const entries = data.data.filter((e) => dayBucket(e.createdAt) === bucket);
          if (entries.length === 0) return null;
          return (
            <div key={bucket}>
              <p className="border-b border-surface-400/20 bg-surface-100/40 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                {bucket}
              </p>
              {entries.map((entry) => {
                const actor = entry.user;
                const avatarColor = actor ? colors[actor.firstName.charCodeAt(0) % colors.length] : 'bg-surface-400';
                return (
                  <div key={entry.id} className="flex items-center gap-3 border-b border-surface-400/20 px-5 py-3 last:border-0">
                    {actor ? (
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${avatarColor} text-[10px] font-bold text-fg`}>
                        {actor.firstName[0]}{actor.lastName[0]}
                      </div>
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-300">
                        <Cpu className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                    )}
                    <p className="min-w-0 flex-1 truncate text-xs text-slate-400">
                      <span className="font-medium text-slate-200">
                        {actor ? `${actor.firstName} ${actor.lastName}` : 'System'}
                      </span>
                      {' '}{describeActivity(entry)}
                    </p>
                    <span className="shrink-0 text-xs text-slate-600 tabular-nums">{timeAgo(entry.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}


function BillingCard({ memberCount, canManage }: { memberCount: number; canManage: boolean }) {
  const { label: planLabel } = usePlan();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openPortal = async () => {
    setBusy(true);
    setError('');
    try {
      const url = await billingService.createPortal();
      window.location.href = url;
    } catch (err: unknown) {
      setError((err as Error).message || 'Could not open the billing portal.');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-500" />
            <CardTitle>Billing</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-fg">{planLabel} Plan</p>
              <p className="mt-0.5 text-xs text-slate-500">{memberCount} {memberCount === 1 ? 'member' : 'members'} on this workspace</p>
            </div>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={openPortal} loading={busy}>
                Manage subscription →
              </Button>
            )}
          </div>
          {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        </CardBody>
      </Card>
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
      <div className="mx-4 w-full max-w-md rounded-2xl border border-surface-400/40 bg-surface-100 p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-fg">
            {createdToken ? 'Invite link ready' : 'Invite a team member'}
          </h2>
          <button onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        {!createdToken ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Email address</label>
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
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Role</label>
              <Select value={role} onChange={(v) => setRole(v as UserRole)} options={INVITE_ROLE_OPTIONS} />
            </div>
            {error && <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" loading={createMutation.isPending} disabled={!email.trim()} onClick={() => createMutation.mutate()}>
                <LinkIcon className="h-3.5 w-3.5" />
                Generate invite link
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-success/20 bg-success/10 px-4 py-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium text-success">Invite created</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  For <span className="text-slate-300">{email}</span> as{' '}
                  <span className="text-slate-300">{ROLE_CONFIG[role]?.label}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Share this link</label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-lg border border-surface-400/40 bg-surface-200/60 px-3 py-2">
                  <p className="truncate font-mono text-xs text-slate-400">{inviteLink}</p>
                </div>
                <CopyButton text={inviteLink} />
              </div>
              <p className="text-[11px] text-slate-600">Expires in 7 days. Send this link directly to the person you're inviting.</p>
            </div>
            <div className="mt-1 flex justify-end">
              <Button size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


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
    <div id="settings" className="max-w-2xl scroll-mt-4">
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
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</p>
                <p className="text-sm text-slate-200">{org?.name || '—'}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Industry</p>
                <p className="text-sm text-slate-200">{org?.industry || '—'}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Currency · Timezone</p>
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
      <div className="mx-4 w-full max-w-md rounded-2xl border border-danger/30 bg-surface-100 p-6 shadow-xl">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-danger/20 bg-danger/10">
            <Crown className="h-4 w-4 text-danger" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-fg">Transfer Ownership</h2>
            <p className="mt-0.5 text-xs text-slate-500">This cannot be undone. You will become an Admin.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Transfer to</label>
            <Select value={selectedId} onChange={setSelectedId} options={memberOptions} />
          </div>
          {selectedMember && (
            <div className="flex items-center gap-3 rounded-xl border border-surface-400/40 bg-surface-200/50 px-4 py-3">
              <MemberAvatar member={selectedMember} />
              <div>
                <p className="text-sm font-semibold text-fg">{selectedMember.firstName} {selectedMember.lastName}</p>
                <p className="text-xs text-slate-500">{selectedMember.email}</p>
              </div>
            </div>
          )}
          {selectedId && (
            <label className="flex cursor-pointer items-start gap-3">
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
          {error && <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              loading={transferMutation.isPending}
              disabled={!selectedId || !confirmed}
              onClick={() => transferMutation.mutate()}
              className="border-danger/50 bg-danger/80 text-white hover:bg-danger"
            >
              Transfer ownership
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


function DangerZone({ members }: { members: TeamMember[] }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [transferred, setTransferred] = useState(false);

  const eligibleCount = members.filter((m) => m.isActive && m.role !== 'SUPER_ADMIN').length;

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
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-surface-400/40 bg-surface-100 px-4 py-3 text-left transition-colors hover:bg-surface-200/40"
      >
        <AlertTriangle className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-300">Danger Zone</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-4">
          <p className="text-sm font-semibold text-fg">Transfer Ownership</p>
          <p className="mb-3 mt-1 text-xs text-slate-500">
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
              disabled={eligibleCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Crown className="h-3.5 w-3.5" />
              Transfer ownership…
            </button>
          )}
          {eligibleCount === 0 && (
            <p className="mt-2 text-[11px] text-slate-600">Invite and activate another member before you can transfer ownership.</p>
          )}
        </div>
      )}

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


export default function OrganizationPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isOwner = currentUser?.role === 'SUPER_ADMIN';
  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const [showInvite, setShowInvite] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.listUsers,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: usersService.listInvites,
    enabled: canManage,
    staleTime: 30_000,
  });

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;
  const activeCount = members.filter((m) => m.isActive).length;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Organization"
        description="Manage your team, access and workspace settings"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Invite member
            </Button>
          ) : undefined
        }
      />

      <OrgSummary members={members} />

      {canManage && (
        <TodaysWork members={members} invites={invites} onOpenMember={setSelectedMemberId} />
      )}

      <InvitationsSection invites={invites} canManage={canManage} />

      <TeamSection
        members={members}
        isLoading={isLoading}
        currentUserId={currentUser?.id ?? ''}
        canInvite={canManage}
        onInvite={() => setShowInvite(true)}
        onOpenMember={setSelectedMemberId}
      />

      <RecentActivity />

      {canManage && <BillingCard memberCount={activeCount} canManage={canManage} />}

      <OrgSettingsCard />

      {isOwner && <DangerZone members={members} />}

      <MemberWorkspace
        member={selectedMember}
        currentUser={currentUser ? { id: currentUser.id, role: currentUser.role as UserRole } : null}
        onClose={() => setSelectedMemberId(null)}
      />

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
