import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, FileText, ChevronRight, X } from 'lucide-react';
import { leasesService } from '@/services/leases.service';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, daysUntil } from '@/utils/format';

const RISK_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'brand' | 'danger'> = {
  ACTIVE: 'success',
  EXPIRED: 'neutral',
  PENDING: 'brand',
  TERMINATED: 'danger',
};

export default function LeasesPage() {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = searchParams.get('propertyId') ?? undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['leases', { search, renewalRisk: riskFilter, page, propertyId }],
    queryFn: () => leasesService.getLeases({ search: search || undefined, renewalRisk: riskFilter || undefined, propertyId, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ['leases', 'stats'],
    queryFn: leasesService.getStats,
  });

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Lease Intelligence</h1>
          <p className="mt-0.5 text-sm text-slate-500">Contract visibility & renewal risk monitoring</p>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Active', value: stats.totalActive, color: 'text-success' },
            { label: 'Expiring 30d', value: stats.expiringIn30, color: 'text-danger' },
            { label: 'Expiring 90d', value: stats.expiringIn90, color: 'text-warning' },
            { label: 'Critical Risk', value: stats.byRisk.find(r => r.renewalRisk === 'CRITICAL')?._count ?? 0, color: 'text-danger' },
          ].map((s) => (
            <Card key={s.label} className="text-center p-4">
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Active property filter chip */}
      {propertyId && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filtered by property</span>
          <button
            onClick={() => setSearchParams({})}
            className="flex items-center gap-1 rounded-full bg-brand-600/20 border border-brand-600/30 px-2.5 py-0.5 text-xs text-brand-300 hover:bg-danger/20 hover:text-danger hover:border-danger/30 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear filter
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search leases..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-slate-600" />
          {['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((risk) => (
            <button
              key={risk}
              onClick={() => { setRiskFilter(risk); setPage(1); }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                riskFilter === risk
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-surface-500'
              }`}
            >
              {risk || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <PageLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {['Lease', 'Property', 'Tenant', 'Base Rent', 'Expiry', 'Days Left', 'Risk', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400/30">
                {data?.data.map((lease) => {
                  const days = daysUntil(lease.endDate);
                  return (
                    <tr
                      key={lease.id}
                      onClick={() => navigate(`/leases/${lease.id}`)}
                      className="cursor-pointer hover:bg-surface-200/40 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                          <span className="text-sm font-medium text-slate-200 font-mono">{lease.leaseNumber}</span>
                        </div>
                        {lease.unitNumber && <p className="ml-5.5 text-xs text-slate-500 mt-0.5">{lease.unitNumber}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{lease.property.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{lease.tenant.name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-white tabular-nums">{formatCurrency(lease.baseRent)}/mo</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{formatDate(lease.endDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold tabular-nums ${
                          days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : days <= 90 ? 'text-yellow-400' : 'text-slate-400'
                        }`}>
                          {days > 0 ? `${days}d` : 'Expired'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={RISK_VARIANT[lease.renewalRisk] ?? 'neutral'} dot>
                          {lease.renewalRisk}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[lease.status] ?? 'neutral'}>
                          {lease.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {data?.data.length === 0 && (
              <div className="py-16 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-3 text-sm text-slate-500">No leases found</p>
              </div>
            )}

            {/* Pagination */}
            {data && data.meta.pages > 1 && (
              <div className="flex items-center justify-between border-t border-surface-400/40 px-5 py-3">
                <p className="text-xs text-slate-600">{data.meta.total} total leases</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!data.meta.hasPrev}
                    className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-white transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-600">{page} / {data.meta.pages}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!data.meta.hasNext}
                    className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-white transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
