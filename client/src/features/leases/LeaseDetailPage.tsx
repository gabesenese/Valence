import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, User, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { leasesService } from '@/services/leases.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, daysUntil, formatPercent } from '@/utils/format';

const RISK_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: lease, isLoading } = useQuery({
    queryKey: ['leases', id],
    queryFn: () => leasesService.getLease(id!),
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (!lease) return <div className="p-6 text-slate-500">Lease not found</div>;

  const days = daysUntil(lease.endDate);

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/leases')}>
          <ArrowLeft className="h-4 w-4" />
          Leases
        </Button>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-400 font-mono">{lease.leaseNumber}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono">{lease.leaseNumber}</h1>
            <Badge variant={RISK_VARIANT[lease.renewalRisk] ?? 'neutral'} dot>{lease.renewalRisk} RISK</Badge>
            <Badge variant={lease.status === 'ACTIVE' ? 'success' : 'neutral'}>{lease.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{lease.property.name} — {lease.unitNumber || 'No unit specified'}</p>
        </div>
        <div className={`text-right px-4 py-2 rounded-xl border ${
          days <= 30 ? 'border-danger/30 bg-danger/10' :
          days <= 60 ? 'border-warning/30 bg-warning/10' :
          'border-surface-400/40 bg-surface-200'
        }`}>
          <p className={`text-3xl font-bold tabular-nums ${days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : 'text-white'}`}>
            {days > 0 ? days : 0}
          </p>
          <p className="text-2xs text-slate-500">days remaining</p>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Property</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-400" />
              <span className="text-sm text-slate-200">{lease.property.name}</span>
            </div>
            <div className="text-2xs text-slate-600 font-mono">{lease.property.code}</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tenant</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-success" />
              <span className="text-sm text-slate-200">{lease.tenant.name}</span>
            </div>
            {lease.tenant.email && (
              <span className="text-xs text-slate-500">{lease.tenant.email}</span>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Base Rent</span>
              <span className="text-sm font-semibold text-white">{formatCurrency(lease.baseRent)}/mo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Escalation</span>
              <span className="text-sm text-slate-300">{formatPercent(lease.rentEscalation * 100, 2)} / yr</span>
            </div>
            {lease.securityDeposit && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Security Deposit</span>
                <span className="text-sm text-slate-300">{formatCurrency(lease.securityDeposit)}</span>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lease Term</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Start</span>
              <span className="text-sm text-slate-300">{formatDate(lease.startDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">End</span>
              <span className={`text-sm font-medium ${days <= 60 ? 'text-warning' : 'text-slate-300'}`}>{formatDate(lease.endDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Type</span>
              <span className="text-sm text-slate-300">{lease.type}</span>
            </div>
            {lease.sqft && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sq. Ft.</span>
                <span className="text-sm text-slate-300">{lease.sqft.toLocaleString()}</span>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
