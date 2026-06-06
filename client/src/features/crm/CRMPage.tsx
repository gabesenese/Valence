import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Phone, Mail, Building2, User, Calendar,
  MessageSquare, PhoneCall, Mail as MailIcon, Users, AlertCircle,
  ChevronRight, Plus, X, Clock,
} from 'lucide-react';
import { crmService, type CrmTenant, type CrmStatus, type ContactLogType, type CrmTenantProfile } from '@/services/crm.service';
import { usersService } from '@/services/users.service';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PageLoader } from '@/components/ui/Spinner';

// ─── Config ───────────────────────────────────────────────────────────────────

const CRM_STATUS_CONFIG: Record<CrmStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  ACTIVE:     { label: 'Active',      variant: 'success'  },
  AT_RISK:    { label: 'At Risk',     variant: 'warning'  },
  HIGH_VALUE: { label: 'High Value',  variant: 'info'     },
  CHURNED:    { label: 'Churned',     variant: 'danger'   },
};

const LOG_TYPE_CONFIG: Record<ContactLogType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  CALL:       { label: 'Call',       icon: PhoneCall     },
  EMAIL:      { label: 'Email',      icon: MailIcon      },
  MEETING:    { label: 'Meeting',    icon: Users         },
  NOTE:       { label: 'Note',       icon: MessageSquare },
  SITE_VISIT: { label: 'Site Visit', icon: Building2     },
};

const LOG_TYPES: ContactLogType[] = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'SITE_VISIT'];

function formatDate(s: string | null) {
  if (!s) return 'Never';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Add contact log form ─────────────────────────────────────────────────────

function AddContactLog({
  tenantId,
  leases,
  onDone,
}: {
  tenantId: string;
  leases: CrmTenantProfile['leases'];
  onDone: () => void;
}) {
  const [type, setType] = useState<ContactLogType>('CALL');
  const [body, setBody] = useState('');
  const [leaseId, setLeaseId] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => crmService.addContactLog(tenantId, { type, body: body.trim(), leaseId: leaseId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', tenantId] });
      qc.invalidateQueries({ queryKey: ['crm-tenants'] });
      onDone();
    },
  });

  return (
    <div className="rounded-xl border border-surface-400/40 bg-surface-200/40 p-4 flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        {LOG_TYPES.map((t) => {
          const cfg = LOG_TYPE_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                type === t
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                  : 'border border-surface-400/40 text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Add ${LOG_TYPE_CONFIG[type].label.toLowerCase()} notes…`}
        rows={3}
        className="rounded-lg border border-surface-400/40 bg-surface-300/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 resize-none"
      />

      {leases.length > 0 && (
        <Select
          value={leaseId}
          onChange={setLeaseId}
          options={[
            { value: '', label: 'No specific lease' },
            ...leases.map((l) => ({ value: l.id, label: `${l.leaseNumber} — ${l.property.name}` })),
          ]}
        />
      )}

      <div className="flex gap-2">
        <Button size="sm" disabled={!body.trim()} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Log Contact
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Tenant detail panel ──────────────────────────────────────────────────────

function TenantPanel({ tenant, onClose }: { tenant: CrmTenant; onClose: () => void }) {
  const qc = useQueryClient();
  const [showAddLog, setShowAddLog] = useState(false);
  const [editStatus, setEditStatus] = useState<CrmStatus>(tenant.crmStatus);
  const [renewalProb, setRenewalProb] = useState<string>(tenant.renewalProbability?.toString() ?? '');
  const [managerId, setManagerId] = useState<string>(tenant.assignedManager?.id ?? '');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['crm', tenant.id],
    queryFn: () => crmService.getTenantProfile(tenant.id),
  });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersService.listUsers });

  const updateMutation = useMutation({
    mutationFn: () => crmService.updateTenant(tenant.id, {
      crmStatus: editStatus,
      renewalProbability: renewalProb !== '' ? Number(renewalProb) : null,
      assignedManagerId: managerId || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-tenants'] });
      qc.invalidateQueries({ queryKey: ['crm', tenant.id] });
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: crmService.deleteContactLog,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', tenant.id] }),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-surface-50 border-l border-surface-400/40 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-surface-400/30 sticky top-0 bg-surface-50 z-10">
          <div>
            <h2 className="text-base font-semibold text-white">{tenant.name}</h2>
            {tenant.company && <p className="text-xs text-slate-500 mt-0.5">{tenant.company}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? <PageLoader /> : profile ? (
          <div className="flex flex-col gap-5 p-5">
            {/* Contact info */}
            <div className="flex flex-col gap-1.5">
              {tenant.email && (
                <a href={`mailto:${tenant.email}`} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
                  <Mail className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  {tenant.email}
                </a>
              )}
              {tenant.phone && (
                <a href={`tel:${tenant.phone}`} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
                  <Phone className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  {tenant.phone}
                </a>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                Last contact: {formatDate(tenant.lastContactAt)}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Monthly Rent', value: `$${Math.round(profile.totalMonthlyRent).toLocaleString()}` },
                { label: 'Open Alerts', value: String(profile.openAlerts), danger: profile.openAlerts > 0 },
                { label: 'Expiring Soon', value: String(profile.expiringSoon), danger: profile.expiringSoon > 0 },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-surface-400/40 bg-surface-200/40 px-3 py-2.5 text-center">
                  <p className={`text-lg font-bold ${kpi.danger ? 'text-warning' : 'text-white'}`}>{kpi.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* CRM settings */}
            <div className="rounded-xl border border-surface-400/40 bg-surface-200/30 p-4 flex flex-col gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">CRM Settings</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 mb-1 block">Status</label>
                  <Select
                    value={editStatus}
                    onChange={(v) => setEditStatus(v as CrmStatus)}
                    options={(['ACTIVE', 'HIGH_VALUE', 'AT_RISK', 'CHURNED'] as CrmStatus[]).map((s) => ({
                      value: s, label: CRM_STATUS_CONFIG[s].label,
                    }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 mb-1 block">Renewal Probability %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={renewalProb}
                    onChange={(e) => setRenewalProb(e.target.value)}
                    placeholder="—"
                    className="w-full rounded-lg border border-surface-400/40 bg-surface-300/60 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Assigned Manager</label>
                <Select
                  value={managerId}
                  onChange={setManagerId}
                  options={[
                    { value: '', label: 'No manager assigned' },
                    ...users.filter((u) => u.isActive).map((u) => ({
                      value: u.id, label: `${u.firstName} ${u.lastName}`,
                    })),
                  ]}
                />
              </div>

              <Button size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                Save Changes
              </Button>
            </div>

            {/* Active leases */}
            {profile.leases.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Active Leases</p>
                <div className="flex flex-col gap-2">
                  {profile.leases.map((l) => {
                    const days = Math.ceil((new Date(l.endDate).getTime() - Date.now()) / 86400000);
                    return (
                      <div key={l.id} className="flex items-center justify-between rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2.5">
                        <div>
                          <p className="text-xs font-medium text-slate-300">{l.property.name}</p>
                          <p className="text-[11px] text-slate-500">{l.leaseNumber} · ${Number(l.baseRent).toLocaleString()}/mo</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-medium ${days <= 30 ? 'text-danger' : days <= 90 ? 'text-warning' : 'text-slate-400'}`}>
                            {days}d left
                          </p>
                          <p className="text-[10px] text-slate-600">{l.renewalStage.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Communication history */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Communication History</p>
                {!showAddLog && (
                  <button
                    onClick={() => setShowAddLog(true)}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Log Contact
                  </button>
                )}
              </div>

              {showAddLog && (
                <div className="mb-3">
                  <AddContactLog
                    tenantId={tenant.id}
                    leases={profile.leases}
                    onDone={() => setShowAddLog(false)}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                {profile.recentContacts.length === 0 && !showAddLog && (
                  <p className="text-xs text-slate-600 py-2">No contact history yet.</p>
                )}
                {profile.recentContacts.map((log) => {
                  const cfg = LOG_TYPE_CONFIG[log.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={log.id} className="group flex items-start gap-3 rounded-lg border border-surface-400/20 bg-surface-200/20 px-3 py-2.5">
                      <div className="mt-0.5 rounded-md bg-surface-300/50 p-1.5 shrink-0">
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium text-slate-400">{cfg.label}</p>
                          <span className="text-[10px] text-slate-600 shrink-0">{formatTimeAgo(log.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 leading-snug">{log.body}</p>
                        {log.user && (
                          <p className="text-[10px] text-slate-600 mt-1">
                            {log.user.firstName} {log.user.lastName}
                            {log.lease && ` · ${log.lease.leaseNumber}`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteLogMutation.mutate(log.id)}
                        className="shrink-0 text-slate-700 hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Tenant card ──────────────────────────────────────────────────────────────

function TenantCard({ tenant, onClick }: { tenant: CrmTenant; onClick: () => void }) {
  const statusCfg = CRM_STATUS_CONFIG[tenant.crmStatus];
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-surface-400/40 bg-surface-100 p-4 hover:bg-surface-100/80 hover:border-brand-500/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{tenant.name}</p>
          {tenant.company && <p className="text-xs text-slate-500 truncate">{tenant.company}</p>}
        </div>
        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
        <span>${Math.round(tenant.totalMonthlyRent).toLocaleString()}/mo</span>
        <span>{tenant._count.leases} lease{tenant._count.leases !== 1 ? 's' : ''}</span>
        {tenant.expiringSoon > 0 && (
          <span className="text-warning flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {tenant.expiringSoon} expiring
          </span>
        )}
      </div>

      {tenant.renewalProbability !== null && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>Renewal probability</span>
            <span className="font-semibold text-slate-300">{tenant.renewalProbability}%</span>
          </div>
          <div className="h-1 rounded-full bg-surface-400/30 overflow-hidden">
            <div
              className={`h-full rounded-full ${tenant.renewalProbability >= 70 ? 'bg-success' : tenant.renewalProbability >= 40 ? 'bg-warning' : 'bg-danger'}`}
              style={{ width: `${tenant.renewalProbability}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          {tenant.assignedManager ? (
            <>
              <User className="h-3 w-3 text-slate-600 shrink-0" />
              {tenant.assignedManager.firstName} {tenant.assignedManager.lastName}
            </>
          ) : (
            <span className="text-slate-600">No manager</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <Calendar className="h-3 w-3" />
          {formatDate(tenant.lastContactAt)}
        </div>
      </div>

      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CRM_STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All',        value: '' },
  { label: 'Active',     value: 'ACTIVE' },
  { label: 'High Value', value: 'HIGH_VALUE' },
  { label: 'At Risk',    value: 'AT_RISK' },
  { label: 'Churned',    value: 'CHURNED' },
];

export default function CRMPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CrmStatus | ''>('');
  const [selected, setSelected] = useState<CrmTenant | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-tenants', { search, statusFilter }],
    queryFn: () => crmService.getTenants({
      search: search || undefined,
      crmStatus: statusFilter || undefined,
    }),
    placeholderData: (prev) => prev,
  });

  const tenants = data?.data ?? [];
  const atRiskCount = tenants.filter((t) => t.crmStatus === 'AT_RISK').length;
  const highValueCount = tenants.filter((t) => t.crmStatus === 'HIGH_VALUE').length;
  const noContactCount = tenants.filter((t) => !t.lastContactAt).length;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">CRM</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {data?.meta.total ?? 0} tenants
            {atRiskCount > 0 && ` · ${atRiskCount} at risk`}
            {highValueCount > 0 && ` · ${highValueCount} high value`}
          </p>
        </div>
      </div>

      {/* Summary chips */}
      {(atRiskCount > 0 || noContactCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {atRiskCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-warning/20 bg-warning/5 px-3 py-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs text-warning font-medium">{atRiskCount} at risk</span>
            </div>
          )}
          {noContactCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-50 px-3 py-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs text-slate-400">{noContactCount} never contacted</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search tenants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex rounded-lg border border-surface-400/40 overflow-hidden">
          {CRM_STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value as CrmStatus | '')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-brand-600/20 text-brand-300'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-200/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <PageLoader />
      ) : tenants.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">No tenants match these filters</p>
          </div>
        </Card>
      ) : (
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((t) => (
            <TenantCard key={t.id} tenant={t} onClick={() => setSelected(t)} />
          ))}
        </div>
      )}

      {selected && <TenantPanel tenant={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
