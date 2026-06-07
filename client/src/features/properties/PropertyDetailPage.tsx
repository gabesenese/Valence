import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, MapPin, FileText, AlertTriangle,
  DollarSign, Layers, Pencil, X, Play, Check, RotateCcw, Sparkles,
  PlusCircle, Edit3, Trash2, History,
} from 'lucide-react';
import { propertiesService, type PropertyDetail, type PropertyActivityEntry } from '@/services/properties.service';
import { alertsService } from '@/services/alerts.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, daysUntil, formatRelative } from '@/utils/format';
import PropertyFormModal from './PropertyFormModal';
import LeaseImportModal from '../leases/LeaseImportModal';
import LeaseFormModal from '../leases/LeaseFormModal';
import type { ExtractedLease } from '@/services/ai.service';

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-danger', WARNING: 'bg-warning', INFO: 'bg-info',
};

const RISK_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importedValues, setImportedValues] = useState<Partial<Record<string, string>> | null>(null);
  const [addLeaseOpen, setAddLeaseOpen] = useState(false);
  const qc = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ['properties', id],
    queryFn: () => propertiesService.getProperty(id!),
    enabled: !!id,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['properties', id, 'alerts'],
    queryFn: () => alertsService.getAlerts({ propertyId: id, statuses: ['OPEN', 'IN_PROGRESS'], limit: 50 }),
    enabled: !!id && !!property && property._count.alerts > 0,
  });

  const invalidateAlerts = () => {
    qc.invalidateQueries({ queryKey: ['properties', id, 'alerts'] });
    qc.invalidateQueries({ queryKey: ['properties', id] });
  };

  const { data: activityData } = useQuery({
    queryKey: ['properties', id, 'activity'],
    queryFn: () => propertiesService.getActivity(id!),
    enabled: !!id,
  });

  const resolveMutation = useMutation({ mutationFn: (aid: string) => alertsService.resolve(aid), onSuccess: invalidateAlerts });
  const dismissMutation = useMutation({ mutationFn: (aid: string) => alertsService.dismiss(aid), onSuccess: invalidateAlerts });
  const progressMutation = useMutation({ mutationFn: (aid: string) => alertsService.progress(aid), onSuccess: invalidateAlerts });
  const reopenMutation = useMutation({ mutationFn: (aid: string) => alertsService.reopen(aid), onSuccess: invalidateAlerts });

  if (isLoading) return <PageLoader />;
  if (!property) return <div className="p-6 text-slate-500">Property not found</div>;

  const monthlyRevenue = property.leases.reduce((sum, l) => sum + Number(l.baseRent), 0);
  const occupancyPct = property.totalUnits > 0
    ? Math.round((property.leases.length / property.totalUnits) * 100)
    : null;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/properties')}>
          <ArrowLeft className="h-4 w-4" />
          Properties
        </Button>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-400 font-mono">{property.code}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/20 border border-brand-600/30">
            <Building2 className="h-6 w-6 text-brand-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">{property.name}</h1>
              <Badge variant={property.status === 'ACTIVE' ? 'success' : 'neutral'}>{property.status}</Badge>
              <Badge variant="neutral">{property.type.replace('_', ' ')}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {property.address}, {property.city}, {property.state} {property.zipCode}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-600 bg-surface-300 px-2 py-1 rounded">{property.code}</span>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: 'Occupancy',
            value: occupancyPct !== null ? `${occupancyPct}%` : '—',
            color: occupancyPct === null ? 'text-slate-500' : occupancyPct >= 80 ? 'text-success' : occupancyPct >= 60 ? 'text-warning' : 'text-danger',
          },
          { label: 'Active Leases', value: property.leases.length, color: 'text-success' },
          { label: 'Monthly Revenue', value: formatCurrency(monthlyRevenue), color: 'text-success' },
          { label: 'Open Alerts', value: property._count.alerts, color: property._count.alerts > 0 ? 'text-danger' : 'text-slate-500' },
          { label: 'Current Value', value: property.currentValue ? `$${(property.currentValue / 1_000_000).toFixed(1)}M` : '—', color: 'text-brand-400' },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 text-center">
            <p className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{kpi.label}</p>
          </Card>
        ))}
      </div>

      {/* Body: main content + sidebar */}
      <div className="flex gap-5 items-start">

        {/* Main: Active Leases */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Active Leases</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">{property.leases.length} leases</span>
                <button
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-600/15 hover:bg-brand-600/25 px-2.5 py-1 text-xs font-medium text-brand-300 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Import from PDF
                </button>
              </div>
            </CardHeader>
            {property.leases.length === 0 ? (
              <EmptyState icon={FileText} title="No active leases on this property" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-400/40">
                      {['Lease', 'Tenant', 'Unit', 'Base Rent', 'Expiry', 'Risk'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-400/30">
                    {property.leases.map((lease) => {
                      const days = daysUntil(lease.endDate);
                      return (
                        <tr key={lease.id} className="group hover:bg-surface-200/40 transition-colors">
                          <td className="px-4 py-3">
                            <Link to={`/leases/${lease.id}`} className="flex items-center gap-2 hover:text-brand-300 transition-colors">
                              <FileText className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                              <span className="text-sm font-medium text-slate-200 font-mono group-hover:text-brand-300">
                                {lease.leaseNumber}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-300">{lease.tenant.name}</p>
                            {lease.tenant.email && <p className="text-xs text-slate-500">{lease.tenant.email}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{lease.unitNumber ?? '—'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-white tabular-nums">{formatCurrency(lease.baseRent)}/mo</td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-400">{formatDate(lease.endDate)}</p>
                            <p className={`text-xs font-semibold tabular-nums ${
                              days <= 30 ? 'text-danger' : days <= 90 ? 'text-warning' : 'text-slate-600'
                            }`}>{days > 0 ? `${days}d left` : 'Expired'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={RISK_VARIANT[lease.renewalRisk] ?? 'neutral'} dot>
                              {lease.renewalRisk}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 flex flex-col gap-4">

          {/* Open alerts */}
          {property._count.alerts > 0 && (
            <div className="rounded-lg border border-danger/20 overflow-hidden">
              <div className="flex items-center gap-2 bg-danger/10 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                <span className="text-xs font-semibold text-danger">
                  {property._count.alerts} Open Alert{property._count.alerts !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-surface-400/20">
                {alertsLoading ? (
                  <div className="px-4 py-4 text-xs text-slate-500">Loading…</div>
                ) : (
                  alertsData?.data.map((alert) => (
                    <div key={alert.id} className="group px-4 py-3 hover:bg-white/[0.02] transition-colors">

                      {/* Title + dismiss */}
                      <div className="flex items-start gap-2 mb-2.5">
                        <span className={`mt-[5px] h-1.5 w-1.5 rounded-full shrink-0 ${SEVERITY_DOT[alert.severity] ?? 'bg-slate-500'}`} />
                        <p className="flex-1 text-[13px] font-medium text-slate-200 leading-snug">{alert.title}</p>
                        <button
                          onClick={() => dismissMutation.mutate(alert.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0 text-slate-600 hover:text-slate-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="pl-3.5 flex items-center gap-1.5">
                        {alert.status === 'OPEN' ? (
                          <button
                            onClick={() => progressMutation.mutate(alert.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-600/20 border border-brand-500/25 px-2.5 py-1 text-[11px] font-medium text-brand-300 hover:bg-brand-600/35 hover:border-brand-500/40 transition-all"
                          >
                            <Play className="h-2.5 w-2.5" />
                            Review
                          </button>
                        ) : (
                          <button
                            onClick={() => reopenMutation.mutate(alert.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-surface-300/60 border border-surface-400/40 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-surface-300/80 transition-all"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            In Review
                          </button>
                        )}
                        <button
                          onClick={() => resolveMutation.mutate(alert.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/20 px-2.5 py-1 text-[11px] font-medium text-success/80 hover:bg-success/25 hover:text-success hover:border-success/35 transition-all"
                        >
                          <Check className="h-2.5 w-2.5" />
                          Resolve
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Building details */}
          <Card>
            <CardHeader><CardTitle>Building Details</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-3">
              {[
                { label: 'Total Sq. Ft.', value: Number(property.totalSqft).toLocaleString(), icon: Layers },
                { label: 'Total Units', value: property.totalUnits, icon: Building2 },
                ...(property.yearBuilt ? [{ label: 'Year Built', value: property.yearBuilt, icon: Building2 }] : []),
                ...(property.purchasePrice ? [{ label: 'Purchase Price', value: formatCurrency(property.purchasePrice), icon: DollarSign }] : []),
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon className="h-3.5 w-3.5" />{label}
                  </span>
                  <span className="text-sm font-medium text-slate-300">{String(value)}</span>
                </div>
              ))}
            </CardBody>
          </Card>

        </div>
      </div>

      {/* Activity history */}
      {activityData && activityData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-brand-400" />
              <CardTitle>Activity History</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <ol className="relative border-l border-surface-400/40 ml-2 flex flex-col gap-0">
              {activityData.map((entry: PropertyActivityEntry) => {
                const Icon = entry.action === 'CREATE' ? PlusCircle : entry.action === 'DELETE' ? Trash2 : Edit3;
                const dotColor = entry.action === 'CREATE' ? 'bg-success' : entry.action === 'DELETE' ? 'bg-danger' : 'bg-brand-400';
                const actionLabel = entry.action === 'CREATE' ? 'Created' : entry.action === 'DELETE' ? 'Deleted' : 'Updated';
                const changedKeys = entry.changes ? Object.keys(entry.changes).filter((k) => k !== 'updatedAt') : [];
                return (
                  <li key={entry.id} className="mb-5 ml-5">
                    <span className={`absolute -left-[7px] mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ${dotColor}`}>
                      <Icon className="h-2 w-2 text-white" />
                    </span>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-200">{actionLabel}</p>
                      {entry.user && (
                        <span className="text-xs text-slate-500">
                          by {entry.user.firstName} {entry.user.lastName}
                        </span>
                      )}
                      <span className="text-xs text-slate-600 ml-auto">{formatRelative(entry.createdAt)}</span>
                    </div>
                    {changedKeys.length > 0 && (
                      <p className="mt-0.5 text-xs text-slate-600">
                        Changed: {changedKeys.join(', ')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      )}

      <PropertyFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        property={property as PropertyDetail}
      />

      <LeaseImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={(extracted: ExtractedLease) => {
          const notes = [
            extracted.renewalOptions ? `Renewal Options: ${extracted.renewalOptions}` : '',
            extracted.obligations    ? `Obligations: ${extracted.obligations}`         : '',
            extracted.notes          ? extracted.notes                                  : '',
          ].filter(Boolean).join('\n\n');
          setImportedValues({
            propertyId:      id,
            unitNumber:      extracted.unitNumber      ?? '',
            type:            extracted.leaseType       ?? 'GROSS',
            startDate:       extracted.startDate       ?? '',
            endDate:         extracted.endDate         ?? '',
            baseRent:        extracted.baseRent        != null ? String(extracted.baseRent)        : '',
            rentEscalation:  extracted.rentEscalation  != null ? String(extracted.rentEscalation)  : '0',
            securityDeposit: extracted.securityDeposit != null ? String(extracted.securityDeposit) : '',
            sqft:            extracted.sqft            != null ? String(extracted.sqft)            : '',
            notes,
          });
          setImportOpen(false);
          setAddLeaseOpen(true);
        }}
      />

      <LeaseFormModal
        open={addLeaseOpen}
        onClose={() => { setAddLeaseOpen(false); setImportedValues(null); }}
        initialValues={importedValues ?? undefined}
      />
    </div>
  );
}
