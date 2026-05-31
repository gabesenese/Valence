import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, Building2, Star } from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';

export default function TenantsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', { search, page }],
    queryFn: () => tenantsService.getTenants({ search: search || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Tenants</h1>
          <p className="mt-0.5 text-sm text-slate-500">{data?.meta.total ?? 0} tenants in portfolio</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          type="text"
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
        />
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
                  {['Tenant', 'Company', 'Contact', 'Active Leases', 'Credit Score', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400/30">
                {data?.data.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-surface-200/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600/20">
                          <User className="h-4 w-4 text-brand-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-200">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {tenant.company ? (
                        <div className="flex items-center gap-1.5 text-sm text-slate-400">
                          <Building2 className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                          {tenant.company}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {tenant.email && <span className="text-xs text-slate-400">{tenant.email}</span>}
                        {tenant.phone && <span className="text-xs text-slate-600">{tenant.phone}</span>}
                        {!tenant.email && !tenant.phone && <span className="text-sm text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold tabular-nums ${tenant._count.leases > 0 ? 'text-success' : 'text-slate-500'}`}>
                        {tenant._count.leases}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tenant.creditScore ? (
                        <div className="flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5 text-warning shrink-0" />
                          <span className={`text-sm font-semibold tabular-nums ${
                            tenant.creditScore >= 750 ? 'text-success' :
                            tenant.creditScore >= 650 ? 'text-warning' : 'text-danger'
                          }`}>{tenant.creditScore}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tenant.isActive ? 'success' : 'neutral'}>
                        {tenant.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data?.data.length === 0 && (
              <div className="py-16 text-center">
                <User className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-3 text-sm text-slate-500">No tenants found</p>
              </div>
            )}

            {data && data.meta.pages > 1 && (
              <div className="flex items-center justify-between border-t border-surface-400/40 px-5 py-3">
                <p className="text-xs text-slate-600">{data.meta.total} total tenants</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!data.meta.hasPrev}
                    className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-white transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-600">{page} / {data.meta.pages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
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
