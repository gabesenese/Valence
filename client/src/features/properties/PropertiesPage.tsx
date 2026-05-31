import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin } from 'lucide-react';
import { api, extractPaginated } from '@/services/api';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';

interface Property {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  address: string;
  city: string;
  state: string;
  totalUnits: number;
  totalSqft: number;
  currentValue?: number;
  _count: { leases: number };
}

export default function PropertiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties', { params: { limit: 50 } }).then(extractPaginated<Property>),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Properties</h1>
        <p className="mt-0.5 text-sm text-slate-500">{data?.meta.total ?? 0} properties in portfolio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.data.map((p) => (
          <Card key={p.id} hover className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-brand-600 to-brand-800" />
            <CardBody>
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300">
                  <Building2 className="h-5 w-5 text-brand-400" />
                </div>
                <div className="flex gap-1.5">
                  <Badge variant={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status}</Badge>
                  <Badge variant="neutral">{p.type.replace('_', ' ')}</Badge>
                </div>
              </div>
              <h3 className="font-semibold text-white">{p.name}</h3>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3" />
                {p.city}, {p.state}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-surface-400/30 pt-3">
                <div className="text-center">
                  <p className="text-base font-bold text-white">{p.totalUnits}</p>
                  <p className="text-2xs text-slate-600">Units</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-success">{p._count.leases}</p>
                  <p className="text-2xs text-slate-600">Active Leases</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-brand-400">
                    {p.currentValue ? `$${(p.currentValue / 1_000_000).toFixed(1)}M` : '—'}
                  </p>
                  <p className="text-2xs text-slate-600">Value</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
