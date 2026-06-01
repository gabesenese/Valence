import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Plus, Search } from 'lucide-react';
import { propertiesService, type PropertyType, type PropertyStatus } from '@/services/properties.service';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import PropertyFormModal from './PropertyFormModal';

const TYPE_OPTIONS: { value: PropertyType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'MIXED_USE', label: 'Mixed Use' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'OFFICE', label: 'Office' },
];

const STATUS_OPTIONS: { value: PropertyStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'UNDER_RENOVATION', label: 'Under Renovation' },
  { value: 'DISPOSED', label: 'Disposed' },
];

const SELECT_CLASS = 'h-9 rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 focus:border-brand-500/60 focus:outline-none';

export default function PropertiesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PropertyType | ''>('');
  const [status, setStatus] = useState<PropertyStatus | ''>('');
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['properties', { search, type, status }],
    queryFn: () => propertiesService.getProperties({
      search: search || undefined,
      type: type || undefined,
      status: status || undefined,
    }),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Properties</h1>
          <p className="mt-0.5 text-sm text-slate-500">{data?.meta.total ?? 0} properties in portfolio</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56 rounded-lg border border-surface-400 bg-surface-200 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as PropertyType | '')} className={SELECT_CLASS}>
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as PropertyStatus | '')} className={SELECT_CLASS}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(search || type || status) && (
          <button
            onClick={() => { setSearch(''); setType(''); setStatus(''); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {data?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-10 w-10 text-slate-700 mb-3" />
          <p className="text-sm text-slate-500">No properties found</p>
          {(search || type || status) && (
            <p className="text-xs text-slate-600 mt-1">Try adjusting your filters</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((p) => (
            <Card key={p.id} hover className="overflow-hidden cursor-pointer" onClick={() => navigate(`/properties/${p.id}`)}>
              <div className="h-1.5 bg-gradient-to-r from-brand-600 to-brand-800" />
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300">
                    <Building2 className="h-5 w-5 text-brand-400" />
                  </div>
                  <div className="flex gap-1.5">
                    <Badge variant={p.status === 'ACTIVE' ? 'success' : p.status === 'UNDER_RENOVATION' ? 'warning' : 'neutral'}>
                      {p.status.replace('_', ' ')}
                    </Badge>
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
                    <p className="text-xs text-slate-400">Units</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-success">{p._count.leases}</p>
                    <p className="text-xs text-slate-400">Leases</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-brand-400">
                      {p.currentValue ? `$${(p.currentValue / 1_000_000).toFixed(1)}M` : '—'}
                    </p>
                    <p className="text-xs text-slate-400">Value</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <PropertyFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
