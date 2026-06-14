import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Building2, Star } from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';

type Tenant = Awaited<ReturnType<typeof tenantsService.getTenants>>['data'][number];

const COLUMNS: Column<Tenant>[] = [
  {
    key: 'name',
    header: 'Tenant',
    render: (t) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600/20">
          <User className="h-4 w-4 text-brand-400" />
        </div>
        <span className="text-sm font-medium text-slate-200">{t.name}</span>
      </div>
    ),
  },
  {
    key: 'company',
    header: 'Company',
    render: (t) =>
      t.company ? (
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          {t.company}
        </div>
      ) : (
        <span className="text-sm text-slate-600">—</span>
      ),
  },
  {
    key: 'contact',
    header: 'Contact',
    render: (t) => (
      <div className="flex flex-col gap-0.5">
        {t.email && <span className="text-xs text-slate-400">{t.email}</span>}
        {t.phone && <span className="text-xs text-slate-600">{t.phone}</span>}
        {!t.email && !t.phone && <span className="text-sm text-slate-600">—</span>}
      </div>
    ),
  },
  {
    key: 'leases',
    header: 'Active Leases',
    render: (t) => (
      <span className={`text-sm font-semibold tabular-nums ${t._count.leases > 0 ? 'text-success' : 'text-slate-500'}`}>
        {t._count.leases}
      </span>
    ),
  },
  {
    key: 'creditScore',
    header: 'Credit Score',
    render: (t) =>
      t.creditScore ? (
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 shrink-0 text-warning" />
          <span className={`text-sm font-semibold tabular-nums ${
            t.creditScore >= 750 ? 'text-success' :
            t.creditScore >= 650 ? 'text-warning' : 'text-danger'
          }`}>
            {t.creditScore}
          </span>
        </div>
      ) : (
        <span className="text-sm text-slate-600">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (t) => (
      <Badge variant={t.isActive ? 'success' : 'neutral'}>
        {t.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

export default function TenantsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', { search, page }],
    queryFn: () => tenantsService.getTenants({ search: search || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:gap-6 sm:p-6">
      <PageHeader
        title="Tenants"
        description={`${data?.meta.total ?? 0} tenants in portfolio`}
      />

      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        keyExtractor={(t) => t.id}
        loading={isLoading}
        search={search}
        onSearch={(s) => { setSearch(s); setPage(1); }}
        searchPlaceholder="Search tenants…"
        emptyIcon={User}
        emptyTitle="No tenants found"
        pagination={data ? {
          page,
          pages: data.meta.pages,
          total: data.meta.total,
          label: 'tenants',
          onPageChange: setPage,
        } : undefined}
      />
    </div>
  );
}
