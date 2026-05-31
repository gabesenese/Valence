import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Bell } from 'lucide-react';
import { alertsService } from '@/services/alerts.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { formatRelative } from '@/utils/format';

const SEVERITY_VARIANT: Record<string, 'danger' | 'warning' | 'info'> = {
  CRITICAL: 'danger',
  WARNING: 'warning',
  INFO: 'info',
};

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: alertsService.getSummary,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', statusFilter],
    queryFn: () => alertsService.getAlerts({ status: statusFilter || undefined, limit: 50 }),
  });

  const resolveMutation = useMutation({
    mutationFn: alertsService.resolve,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Alert Center</h1>
        <p className="mt-0.5 text-sm text-slate-500">Anomaly detection & operational risk monitoring</p>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-danger tabular-nums">
              {summary.bySeverity.find(s => s.severity === 'CRITICAL')?._count ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Critical</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-warning tabular-nums">
              {summary.bySeverity.find(s => s.severity === 'WARNING')?._count ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Warning</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-info tabular-nums">
              {summary.bySeverity.find(s => s.severity === 'INFO')?._count ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Info</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-white tabular-nums">{summary.openTotal}</p>
            <p className="mt-0.5 text-xs text-slate-500">Total Open</p>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['OPEN', 'RESOLVED', ''].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40'
                : 'text-slate-500 border border-transparent hover:border-surface-500 hover:text-slate-300'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <Bell className="h-4 w-4 text-slate-600" />
        </CardHeader>
        {isLoading ? <PageLoader /> : (
          <div className="divide-y divide-surface-400/30">
            {data?.data.length === 0 && (
              <div className="py-16 text-center">
                <CheckCircle className="mx-auto h-8 w-8 text-success/40" />
                <p className="mt-3 text-sm text-slate-500">No alerts in this category</p>
              </div>
            )}
            {data?.data.map((alert) => (
              <div key={alert.id} className="flex items-start gap-4 px-5 py-4 hover:bg-surface-200/30 transition-colors">
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
                  alert.severity === 'CRITICAL' ? 'text-danger' :
                  alert.severity === 'WARNING' ? 'text-warning' : 'text-info'
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-200">{alert.title}</p>
                    <Badge variant={SEVERITY_VARIANT[alert.severity] ?? 'neutral'}>{alert.severity}</Badge>
                    <Badge variant="neutral">{alert.type.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{alert.description}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                    {alert.property && <span>{alert.property.name}</span>}
                    {alert.lease && <span>Lease {alert.lease.leaseNumber}</span>}
                    <span>{formatRelative(alert.createdAt)}</span>
                  </div>
                </div>
                {alert.status === 'OPEN' && (
                  <div className="shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveMutation.mutate(alert.id)}
                      loading={resolveMutation.isPending && resolveMutation.variables === alert.id}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Resolve
                    </Button>
                  </div>
                )}
                {alert.status === 'RESOLVED' && (
                  <Badge variant="success">RESOLVED</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
