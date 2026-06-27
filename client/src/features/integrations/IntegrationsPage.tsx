import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plug, Check, RefreshCw, Clock, XCircle, AlertTriangle, ChevronDown, Lock } from 'lucide-react';
import { integrationsService, type IntegrationProvider, type ConnectorCategory, CONNECTOR_CATEGORY_LABEL } from '@/services/integrations.service';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/Spinner';
import { formatRelative } from '@/utils/format';
import { usePlan, PLAN_LABELS, PLAN_PRICES } from '@/hooks/usePlan';
import { MappingCenter } from './MappingCenter';

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { canAccess, requiredPlan } = usePlan();
  const gated = !canAccess('integrations');
  const integrationsPlan = requiredPlan('integrations') ?? 'PROFESSIONAL';

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

  const [syncPrompt, setSyncPrompt] = useState<{ provider: string; unmapped: number } | null>(null);

  const sync = useMutation({
    mutationFn: (id: string) => integrationsService.sync(id),
    onSuccess: (result, id) => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      qc.invalidateQueries({ queryKey: ['integration-history', id] });
      qc.invalidateQueries({ queryKey: ['mapping-queue', id] });
      const unmapped = Object.values(result.summary?.entities ?? {}).reduce((sum, e) => sum + e.unmapped, 0);
      setSyncPrompt(unmapped > 0 ? { provider: id, unmapped } : null);
    },
  });

  const scrollToMapping = () => document.getElementById('mapping-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const authorize = useMutation({
    mutationFn: (id: string) => integrationsService.authorize(id),
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  const handleConnect = (p: IntegrationProvider) => {
    if (p.available && gated) { navigate('/pricing'); return; }
    if (p.available && p.authType === 'oauth2') authorize.mutate(p.id);
    else connect.mutate(p.id);
  };

  const params = new URLSearchParams(window.location.search);
  const connectedReturn = params.get('connected');
  const errorReturn = params.get('error');

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:gap-6 sm:p-6">
      <PageHeader
        title="Integrations"
        description="Connect the property management and accounting software you already use."
      />

      {gated && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand-500/25 bg-brand-600/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-300/60 ring-1 ring-surface-400/40">
              <Lock className="h-4 w-4 text-brand-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-fg">Integrations are a {PLAN_LABELS[integrationsPlan]} feature</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Upgrade to connect QuickBooks and sync your expenses automatically — from ${PLAN_PRICES[integrationsPlan].toLocaleString()}/mo.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="shrink-0 self-start rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500 sm:self-auto"
          >
            View plans
          </button>
        </div>
      )}

      {connectedReturn && (
        <div className="rounded-xl border border-success/20 bg-success/[0.06] px-5 py-3 text-sm text-success">
          Connected {connectedReturn} successfully. Run a sync to pull your data.
        </div>
      )}
      {errorReturn && (
        <div className="rounded-xl border border-danger/20 bg-danger/[0.06] px-5 py-3 text-sm text-danger">
          Couldn't connect {errorReturn}. Please try again.
        </div>
      )}

      {syncPrompt && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/25 bg-warning/[0.06] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-warning">
            Sync complete — {syncPrompt.unmapped} expense{syncPrompt.unmapped !== 1 ? 's' : ''} need a property before they appear in Finance.
          </p>
          <button
            onClick={scrollToMapping}
            className="shrink-0 self-start rounded-lg bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/25 sm:self-auto"
          >
            Map them now ↑
          </button>
        </div>
      )}

      {providers?.some((p) => p.id === 'quickbooks' && p.connection?.status === 'CONNECTED') && (
        <div id="mapping-center" className="scroll-mt-4">
          <MappingCenter provider="quickbooks" />
        </div>
      )}

      <div className="rounded-xl border border-brand-500/20 bg-brand-600/[0.04] px-5 py-4">
        <p className="text-sm text-slate-300">
          Valence is the intelligence layer on top of your PM and accounting software — not a replacement.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          These integrations are on our roadmap. Request the ones you use and we'll prioritise them — you'll be
          notified the moment they go live.
        </p>
      </div>

      {(['property_management', 'accounting', 'crm', 'storage'] as ConnectorCategory[]).map((cat) => {
        const items = providers?.filter((p) => p.category === cat) ?? [];
        if (items.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{CONNECTOR_CATEGORY_LABEL[cat]}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((p) => (
                <IntegrationCard
                  key={p.id}
                  provider={p}
                  locked={p.available && gated}
                  onRequest={() => handleConnect(p)}
                  onCancel={() => disconnect.mutate(p.id)}
                  onSync={() => sync.mutate(p.id)}
                  onDisconnect={() => disconnect.mutate(p.id)}
                  syncing={sync.isPending && sync.variables === p.id}
                  busy={
                    (connect.isPending && connect.variables === p.id) ||
                    (authorize.isPending && authorize.variables === p.id) ||
                    (disconnect.isPending && disconnect.variables === p.id)
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const RUN_STATUS: Record<string, { icon: typeof Check; color: string; label: string }> = {
  success: { icon: Check,         color: 'text-success', label: 'Success' },
  partial: { icon: AlertTriangle, color: 'text-warning', label: 'Partial' },
  error:   { icon: XCircle,       color: 'text-danger',  label: 'Failed' },
  running: { icon: RefreshCw,     color: 'text-brand-400', label: 'Running' },
};

function SyncHistory({ provider }: { provider: string }) {
  const { data: runs, isLoading } = useQuery({
    queryKey: ['integration-history', provider],
    queryFn: () => integrationsService.history(provider),
  });

  if (isLoading) return <p className="px-1 py-2 text-xs text-slate-600">Loading history…</p>;
  if (!runs || runs.length === 0) return <p className="px-1 py-2 text-xs text-slate-600">No syncs yet.</p>;

  return (
    <div className="flex flex-col divide-y divide-surface-400/20">
      {runs.map((run) => {
        const meta = RUN_STATUS[run.status] ?? RUN_STATUS.running;
        const Icon = meta.icon;
        const counts = run.summary
          ? Object.values(run.summary.entities).map((v) => {
              const parts = [`${v.created + v.updated} imported`];
              if (v.unmapped) parts.push(`${v.unmapped} to map`);
              if (v.skipped) parts.push(`${v.skipped} skipped`);
              return parts.join(' · ');
            }).join(' · ')
          : null;
        return (
          <div key={run.id} className="flex items-start gap-2.5 py-2">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.color}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                <span className="text-[10px] text-slate-600">{formatRelative(run.startedAt)}</span>
              </div>
              {counts && <p className="mt-0.5 text-[11px] text-slate-500">{counts}</p>}
              {run.error && <p className="mt-0.5 text-[11px] text-danger/80">{run.error}</p>}
              {run.summary && run.summary.errors.length > 0 && (
                <p className="mt-0.5 text-[11px] text-warning/80">{run.summary.errors.length} record issue(s)</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IntegrationCard({
  provider,
  locked,
  onRequest,
  onCancel,
  onSync,
  onDisconnect,
  syncing,
  busy,
}: {
  provider: IntegrationProvider;
  locked: boolean;
  onRequest: () => void;
  onCancel: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
  busy: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const requested = provider.connection?.status === 'REQUESTED';
  const connected = provider.connection?.status === 'CONNECTED';
  const lastSyncedAt = provider.connection?.lastSyncedAt ?? null;

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
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
                  <Check className="h-3 w-3" /> Connected{lastSyncedAt ? ` · synced ${formatRelative(lastSyncedAt)}` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {connected ? (
              <Button size="sm" variant="secondary" onClick={onSync} loading={syncing}>
                <RefreshCw className="h-3.5 w-3.5" /> Sync now
              </Button>
            ) : requested ? (
              <button
                onClick={onCancel}
                disabled={busy}
                className="text-xs text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
              >
                Cancel
              </button>
            ) : locked ? (
              <Button size="sm" variant="secondary" onClick={onRequest}>
                <Lock className="h-3.5 w-3.5" /> Upgrade
              </Button>
            ) : (
              <Button size="sm" onClick={onRequest} loading={busy}>
                {provider.available ? 'Connect' : 'Request'}
              </Button>
            )}
          </div>
        </div>

        {connected && (
          <div className="border-t border-surface-400/20 pt-2">
            {provider.health && (
              <div className="mb-2 grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-5">
                {[
                  {
                    label: 'Health',
                    value: provider.health.successRatePct != null ? `${provider.health.successRatePct}%` : '—',
                    color: provider.health.successRatePct == null ? 'text-slate-300'
                      : provider.health.successRatePct >= 95 ? 'text-success'
                      : provider.health.successRatePct >= 80 ? 'text-warning' : 'text-danger',
                  },
                  { label: 'Failures 30d', value: String(provider.health.failures30d), color: provider.health.failures30d > 0 ? 'text-danger' : 'text-slate-300' },
                  { label: 'Last success', value: provider.health.lastSuccessAt ? formatRelative(provider.health.lastSuccessAt) : '—', color: 'text-slate-300' },
                  { label: 'Next sync', value: formatRelative(provider.health.nextSyncAt), color: 'text-slate-300' },
                  { label: 'Records', value: String(Object.values(provider.health.records).reduce((s, n) => s + n, 0)), color: 'text-slate-300' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className={`text-xs font-semibold tabular-nums ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-slate-600">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 transition-colors hover:text-slate-300"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} /> Sync history
              </button>
              <button onClick={onDisconnect} disabled={busy} className="text-[11px] text-slate-600 transition-colors hover:text-danger disabled:opacity-50">
                Disconnect
              </button>
            </div>
            {showHistory && <SyncHistory provider={provider.id} />}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
