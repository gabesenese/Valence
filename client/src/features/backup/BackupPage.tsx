import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Download, RotateCcw, Trash2, Plus, Clock, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { backupService, type BackupMeta, type RestoreResult } from '@/services/backup.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}


function RestoreBanner({ result, onDismiss }: { result: RestoreResult; onDismiss: () => void }) {
  const total = result.properties + result.tenants + result.leases + result.financialRecords;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-success">Restore complete — {total} records restored</p>
        <p className="text-xs text-success/70 mt-0.5">
          {result.properties} properties · {result.tenants} tenants · {result.leases} leases · {result.financialRecords} financial records
        </p>
      </div>
      <button onClick={onDismiss} className="text-success/50 hover:text-success text-xs">✕</button>
    </div>
  );
}


function BackupRow({ backup, onRestore, onDelete, apiBase, busy }: {
  backup: BackupMeta;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  apiBase: string;
  busy: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-surface-100/40 hover:bg-surface-100/70 transition-colors">
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
          backup.trigger === 'automated' ? 'bg-brand-600/20 text-brand-300' :
          backup.trigger === 'import'    ? 'bg-warning/15 text-warning' :
                                           'bg-surface-300/60 text-slate-400',
        )}>
          {backup.trigger === 'automated' ? <Clock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
          {backup.trigger === 'automated' ? 'Auto' : backup.trigger === 'import' ? 'Pre-Import' : 'Manual'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg truncate">{backup.label}</p>
        <p className="text-xs text-slate-500">{formatDate(backup.createdAt)} · {formatBytes(backup.sizeBytes)}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`${apiBase}/backups/${backup.id}/download`}
          download
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-400/30 bg-surface-200/60 hover:bg-surface-200 px-2.5 py-1.5 text-xs text-slate-300 transition-colors"
          title="Download as JSON"
        >
          <Download className="h-3.5 w-3.5" />
        </a>

        {confirmRestore ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Overwrite current data?</span>
            <button
              onClick={() => { setConfirmRestore(false); onRestore(backup.id); }}
              disabled={busy}
              className="rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              Yes, restore
            </button>
            <button onClick={() => setConfirmRestore(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRestore(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-400/30 bg-surface-200/60 hover:bg-brand-600/20 hover:border-brand-500/30 hover:text-brand-300 disabled:opacity-50 px-2.5 py-1.5 text-xs text-slate-300 transition-colors"
            title="Restore from this backup"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore
          </button>
        )}

        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setConfirmDelete(false); onDelete(backup.id); }}
              disabled={busy}
              className="rounded-lg bg-danger hover:bg-danger/80 disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/10 hover:bg-danger/20 disabled:opacity-50 px-2.5 py-1.5 text-xs text-danger transition-colors"
            title="Delete this backup"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}


export default function BackupPage() {
  const qc = useQueryClient();
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const apiBase = import.meta.env.VITE_API_URL ?? '/api';

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: backupService.list,
  });

  const createMutation = useMutation({
    mutationFn: backupService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const restoreMutation = useMutation({
    mutationFn: backupService.restore,
    onSuccess: (result) => { setRestoreResult(result); qc.invalidateQueries({ queryKey: ['backups'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: backupService.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const manualCount = backups.filter((b) => b.trigger === 'manual').length;
  const atLimit = manualCount >= 10;

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:gap-6 sm:p-6">
      <PageHeader
        title="Backups"
        description="Automated daily snapshots of your data. Restore to any point in the last 30 days."
        actions={
          <button
            onClick={() => createMutation.mutate(undefined)}
            disabled={createMutation.isPending || atLimit}
            title={atLimit ? 'Delete a manual backup to create a new one' : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {createMutation.isPending ? 'Creating…' : 'Create Backup'}
          </button>
        }
      />

      {restoreResult && <RestoreBanner result={restoreResult} onDismiss={() => setRestoreResult(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Clock, label: 'Daily Automated', value: `${backups.filter((b) => b.trigger === 'automated').length} snapshots`, sub: 'Last 30 days retained' },
          { icon: Shield, label: 'Manual Backups', value: `${manualCount} / 10`, sub: 'Create before major changes' },
          { icon: Database, label: 'Point-in-Time', value: 'Any snapshot', sub: 'Restore to exact data state' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <Card key={label}>
            <CardBody className="flex items-center gap-3 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600/15">
                <Icon className="h-4.5 w-4.5 text-brand-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-fg">{value}</p>
                <p className="text-[11px] text-slate-600">{sub}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600/20 border-t-brand-400" />
        </div>
      )}

      {!isLoading && backups.length === 0 && (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-300/40">
                <Database className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-300">No backups yet</p>
              <p className="text-xs text-slate-500">Automated backups run daily at 3am. Create a manual one now.</p>
            </div>
          </CardBody>
        </Card>
      )}

      {!isLoading && backups.length > 0 && (
        <Card>
          <CardBody className="flex flex-col gap-4 p-0 pt-4">
            <div className="px-4 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
              <p className="text-xs text-warning/80">
                Restoring replaces your current data with the snapshot. This cannot be undone.
              </p>
            </div>
            <div className="rounded-xl border border-surface-400/30 overflow-hidden divide-y divide-surface-400/20 mx-4 mb-4">
              {backups.map((backup) => (
                <BackupRow
                  key={backup.id}
                  backup={backup}
                  apiBase={apiBase}
                  busy={restoreMutation.isPending || deleteMutation.isPending}
                  onRestore={(id) => restoreMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
