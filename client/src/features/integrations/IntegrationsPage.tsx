import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plug, Check, RefreshCw, Clock } from 'lucide-react';
import { integrationsService, type IntegrationProvider } from '@/services/integrations.service';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/Spinner';

export default function IntegrationsPage() {
  const qc = useQueryClient();

  const { data: providers, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationsService.list,
  });

  const connect = useMutation({
    mutationFn: (id: string) => integrationsService.connect(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => integrationsService.disconnect(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:gap-6 sm:p-6">
      <PageHeader
        title="Integrations"
        description="Sync Valence with the property management system you already use."
      />

      <div className="rounded-xl border border-brand-500/20 bg-brand-600/[0.04] px-5 py-4">
        <p className="text-sm text-slate-300">
          Valence works as the intelligence layer on top of your PM software — not a replacement.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          These integrations are on our roadmap. Request the ones you use and we'll prioritise them — you'll be
          notified the moment they go live.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {providers?.map((p) => (
          <IntegrationCard
            key={p.id}
            provider={p}
            onRequest={() => connect.mutate(p.id)}
            onCancel={() => disconnect.mutate(p.id)}
            busy={
              (connect.isPending && connect.variables === p.id) ||
              (disconnect.isPending && disconnect.variables === p.id)
            }
          />
        ))}
      </div>
    </div>
  );
}

function IntegrationCard({
  provider,
  onRequest,
  onCancel,
  busy,
}: {
  provider: IntegrationProvider;
  onRequest: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const requested = provider.connection?.status === 'REQUESTED';
  const connected = provider.connection?.status === 'CONNECTED';

  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-300/60">
            <Plug className="h-4 w-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-fg">{provider.name}</p>
              {provider.available ? (
                <span className="rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Available</span>
              ) : (
                <span className="rounded-full border border-surface-400/40 bg-surface-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coming soon</span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{provider.description}</p>
            {requested && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-brand-300">
                <Clock className="h-3 w-3" /> Requested — we'll notify you when it's ready
              </p>
            )}
            {connected && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-success">
                <Check className="h-3 w-3" /> Connected
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {connected ? (
            <Button size="sm" variant="secondary" disabled>
              <RefreshCw className="h-3.5 w-3.5" /> Synced
            </Button>
          ) : requested ? (
            <button
              onClick={onCancel}
              disabled={busy}
              className="text-xs text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
            >
              Cancel
            </button>
          ) : (
            <Button size="sm" onClick={onRequest} loading={busy}>
              {provider.available ? 'Connect' : 'Request'}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
