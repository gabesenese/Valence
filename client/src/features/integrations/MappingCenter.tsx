import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { integrationsService, type MappingQueue } from '@/services/integrations.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const SOURCE_LABEL: Record<string, string> = { class: 'Class', location: 'Location', customer: 'Customer' };

function AssignRow({
  label, sublabel, properties, action, busy, onSubmit,
}: {
  label: string;
  sublabel: string;
  properties: MappingQueue['properties'];
  action: string;
  busy: boolean;
  onSubmit: (propertyId: string) => void;
}) {
  const [propertyId, setPropertyId] = useState('');
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-surface-400/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-slate-200 truncate">{label}</p>
        <p className="text-[11px] text-slate-500">{sublabel}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="rounded-lg border border-surface-400/40 bg-surface-200 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-brand-500/50 cursor-pointer max-w-[200px]"
        >
          <option value="">Select property…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
          ))}
        </select>
        <Button size="sm" disabled={!propertyId || busy} onClick={() => onSubmit(propertyId)}>{action}</Button>
      </div>
    </div>
  );
}

export function MappingCenter({ provider }: { provider: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['mapping-queue', provider], queryFn: () => integrationsService.mappingQueue(provider) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['mapping-queue', provider] });
    qc.invalidateQueries({ queryKey: ['integrations'] });
    qc.invalidateQueries({ queryKey: ['integration-history', provider] });
    qc.invalidateQueries({ queryKey: ['finance'] });
  };

  const map = useMutation({
    mutationFn: (b: { sourceType: string; sourceValue: string; propertyId: string }) => integrationsService.createMapping(provider, b),
    onSuccess: invalidate,
  });
  const assign = useMutation({
    mutationFn: (b: { propertyId: string; untaggedOnly?: boolean }) => integrationsService.assignPending(provider, b),
    onSuccess: invalidate,
  });

  if (!data || data.pendingTotal === 0) return null;
  const busy = map.isPending || assign.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-warning" />
          <CardTitle>Mapping Center</CardTitle>
        </div>
        <span className="text-xs text-slate-500">{data.pendingTotal} expense{data.pendingTotal !== 1 ? 's' : ''} need a property</span>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        <p className="text-[11px] text-slate-600">
          Map each QuickBooks tag to a Valence property. Mappings are saved, so future syncs resolve automatically.
        </p>
        {data.entities.map((e) => (
          <AssignRow
            key={`${e.sourceType}:${e.value}`}
            label={`${SOURCE_LABEL[e.sourceType] ?? e.sourceType}: ${e.value}`}
            sublabel={`${e.count} expense${e.count !== 1 ? 's' : ''}`}
            properties={data.properties}
            action="Map"
            busy={busy}
            onSubmit={(propertyId) => map.mutate({ sourceType: e.sourceType, sourceValue: e.value, propertyId })}
          />
        ))}
        {data.untaggedCount > 0 && (
          <AssignRow
            label="Untagged expenses"
            sublabel={`${data.untaggedCount} expense${data.untaggedCount !== 1 ? 's' : ''} with no QuickBooks class/location/customer`}
            properties={data.properties}
            action="Assign all"
            busy={busy}
            onSubmit={(propertyId) => assign.mutate({ propertyId, untaggedOnly: true })}
          />
        )}
      </CardBody>
    </Card>
  );
}
