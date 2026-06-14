import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { propertiesService, type PropertyType, type PropertyStatus } from '@/services/properties.service';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import PropertyFormModal from './PropertyFormModal';
import { Select } from '@/components/ui/Select';
import { cn } from '@/utils/cn';

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


export default function PropertiesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PropertyType | ''>('');
  const [status, setStatus] = useState<PropertyStatus | ''>('');
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmId(null);
    setDeletingId(id);
    try {
      await propertiesService.deleteProperty(id);
      qc.setQueriesData<{ data: { id: string }[]; meta: unknown }>(
        { queryKey: ['properties'] },
        (old) => old ? { ...old, data: old.data.filter((p) => p.id !== id) } : old,
      );
      qc.invalidateQueries({ queryKey: ['properties'] });
    } finally {
      setDeletingId(null);
    }
  };

  const cancelConfirm = (e: React.MouseEvent) => { e.stopPropagation(); setConfirmId(null); };

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
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:gap-6 sm:p-6">
      <PageHeader
        title="Properties"
        description={`${data?.meta.total ?? 0} properties in portfolio`}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30 sm:w-56"
          />
        </div>
        <Select value={type} onChange={(v) => setType(v as PropertyType | '')} options={TYPE_OPTIONS} className="w-40" />
        <Select value={status} onChange={(v) => setStatus(v as PropertyStatus | '')} options={STATUS_OPTIONS} className="w-44" />
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
        (search || type || status) ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="h-10 w-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">No properties match your filters</p>
            <p className="text-xs text-slate-600 mt-1">Try adjusting your search</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-200 mb-4">
              <Building2 className="h-7 w-7 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-300">No properties yet</p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
              Your portfolio starts with your first property. Add one manually or import a CSV to get started.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Property
              </button>
              <button
                onClick={() => navigate('/import')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200 hover:bg-surface-300 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors"
              >
                Import from CSV
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((p) => (
            <Card
              key={p.id}
              hover={confirmId !== p.id}
              className={cn('overflow-hidden cursor-pointer', confirmId === p.id && 'border-danger/30')}
              onClick={confirmId === p.id ? undefined : () => navigate(`/properties/${p.id}`)}
            >
              <div className="h-1.5 bg-gradient-to-r from-brand-600 to-brand-800" />
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300">
                    <Building2 className="h-5 w-5 text-brand-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={p.status === 'ACTIVE' ? 'success' : p.status === 'UNDER_RENOVATION' ? 'warning' : 'neutral'}>
                      {p.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="neutral">{p.type.replace('_', ' ')}</Badge>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmId(p.id); }}
                      className={cn(
                        'ml-1 flex h-6 w-6 items-center justify-center rounded-md text-slate-600 hover:bg-danger/15 hover:text-danger transition-all duration-200',
                        confirmId === p.id && 'opacity-0 pointer-events-none',
                      )}
                      title="Delete property"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-white">{p.name}</h3>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" />
                  {p.city}, {p.state}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-surface-400/30 pt-3">
                  {(() => {
                    const pct = p.totalUnits > 0 ? Math.round((p._count.leases / p.totalUnits) * 100) : null;
                    return (
                      <div className="text-center">
                        <p className={`text-base font-bold ${pct === null ? 'text-slate-500' : pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-danger'}`}>
                          {pct !== null ? `${pct}%` : '—'}
                        </p>
                        <p className="text-xs text-slate-400">Occupancy</p>
                      </div>
                    );
                  })()}
                  <div className="text-center">
                    <p className="text-base font-bold text-brand-400">
                      {p.currentValue ? `$${(p.currentValue / 1_000_000).toFixed(1)}M` : '—'}
                    </p>
                    <p className="text-xs text-slate-400">Value</p>
                  </div>
                </div>
              </CardBody>

              {/* Confirmation footer — animates in with max-height + opacity */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-250 ease-in-out',
                  confirmId === p.id ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-t border-danger/20 bg-danger/5 px-4 py-3">
                  <p className="text-xs text-slate-400">
                    Delete <span className="font-semibold text-white">{p.name}</span>?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelConfirm}
                      className="text-xs text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => void handleDelete(e, p.id)}
                      disabled={deletingId === p.id}
                      className="rounded-md bg-danger px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === p.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PropertyFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
