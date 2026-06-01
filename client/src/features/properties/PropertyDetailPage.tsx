import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, MapPin, FileText, AlertTriangle, DollarSign, Layers, Pencil } from 'lucide-react';
import { propertiesService, type PropertyDetail } from '@/services/properties.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, daysUntil } from '@/utils/format';
import PropertyFormModal from './PropertyFormModal';

const RISK_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: property, isLoading } = useQuery({
    queryKey: ['properties', id],
    queryFn: () => propertiesService.getProperty(id!),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (!property) return <div className="p-6 text-slate-500">Property not found</div>;

  const monthlyRevenue = property.leases.reduce((sum, l) => sum + Number(l.baseRent), 0);

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: 'Total Units', value: property.totalUnits, color: 'text-white' },
          { label: 'Active Leases', value: property.leases.length, color: 'text-success' },
          { label: 'Monthly Revenue', value: formatCurrency(monthlyRevenue), color: 'text-success' },
          { label: 'Open Alerts', value: property._count.alerts, color: property._count.alerts > 0 ? 'text-danger' : 'text-slate-500' },
          { label: 'Current Value', value: property.currentValue ? `$${(property.currentValue / 1_000_000).toFixed(1)}M` : '—', color: 'text-brand-400' },
          { label: 'Year Built', value: property.yearBuilt ?? '—', color: 'text-slate-400' },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 text-center">
            <p className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{kpi.label}</p>
          </Card>
        ))}
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Building Details</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            {[
              { label: 'Total Sq. Ft.', value: Number(property.totalSqft).toLocaleString(), icon: Layers },
              { label: 'Total Units', value: property.totalUnits, icon: Building2 },
              ...(property.purchasePrice ? [{ label: 'Purchase Price', value: formatCurrency(property.purchasePrice), icon: DollarSign }] : []),
              ...(property.currentValue ? [{ label: 'Current Value', value: formatCurrency(property.currentValue), icon: DollarSign }] : []),
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

        <Card>
          <CardHeader>
            <CardTitle>Lease Summary</CardTitle>
            <span className="text-xs text-slate-600">{property.leases.length} active</span>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />Monthly Revenue
              </span>
              <span className="text-sm font-semibold text-success">{formatCurrency(monthlyRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Occupancy</span>
              <span className="text-sm font-semibold text-white">
                {property.totalUnits > 0 ? `${Math.round((property.leases.length / property.totalUnits) * 100)}%` : '—'}
              </span>
            </div>
            {property._count.alerts > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2 mt-1">
                <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                <span className="text-xs text-danger">{property._count.alerts} open alert{property._count.alerts !== 1 ? 's' : ''} on this property</span>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Active leases */}
      {property.leases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Leases</CardTitle>
            <span className="text-xs text-slate-600">{property.leases.length} leases</span>
          </CardHeader>
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
                        <Link
                          to={`/leases/${lease.id}`}
                          className="flex items-center gap-2 hover:text-brand-300 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                          <span className="text-sm font-medium text-slate-200 font-mono group-hover:text-brand-300">
                            {lease.leaseNumber}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-400">{lease.tenant.name}</p>
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
        </Card>
      )}

      <PropertyFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        property={property as PropertyDetail}
      />
    </div>
  );
}
