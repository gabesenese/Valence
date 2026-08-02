import { useState } from 'react';
import { Download, Building2, FileText, Users, ClipboardList, Loader2, CheckCircle2, Archive } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/services/api';

interface ExportItem {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
  filename: string;
}

const EXPORTS: ExportItem[] = [
  {
    key: 'properties',
    label: 'Properties',
    description: 'All properties — name, type, address, value, unit count.',
    icon: Building2,
    endpoint: '/export/properties',
    filename: 'properties.csv',
  },
  {
    key: 'leases',
    label: 'Leases',
    description: 'All leases — tenant, rent, dates, status, renewal risk.',
    icon: FileText,
    endpoint: '/export/leases',
    filename: 'leases.csv',
  },
  {
    key: 'tenants',
    label: 'Tenants',
    description: 'Active tenants — contact info, credit score, CRM status.',
    icon: Users,
    endpoint: '/export/tenants',
    filename: 'tenants.csv',
  },
  {
    key: 'tasks',
    label: 'Tasks',
    description: 'All tasks — status, assignee, due date, completion.',
    icon: ClipboardList,
    endpoint: '/export/tasks',
    filename: 'tasks.csv',
  },
];

export default function ExportPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const markDone = (key: string) => {
    setDone((prev) => new Set([...prev, key]));
    setTimeout(() => setDone((prev) => { const n = new Set(prev); n.delete(key); return n; }), 3000);
  };

  const downloadBlob = (data: BlobPart, type: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (item: ExportItem) => {
    setLoading(item.key);
    try {
      const res = await api.get(item.endpoint, { responseType: 'blob' });
      downloadBlob(res.data as BlobPart, 'text/csv', item.filename);
      markDone(item.key);
    } finally {
      setLoading(null);
    }
  };

  const handleExportBundle = async () => {
    setLoading('bundle');
    try {
      const res = await api.get('/export/bundle', { responseType: 'blob' });
      downloadBlob(res.data as BlobPart, 'application/zip', `valence-export-${new Date().toISOString().slice(0, 10)}.zip`);
      markDone('bundle');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        title="Export Center"
        description="Download your portfolio data as CSV. You own your data — take it anywhere."
      />

      <div className="mt-8 flex items-center justify-between gap-4 rounded-xl border border-brand-500/30 bg-brand-500/[0.06] px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15">
            <Archive className="h-4 w-4 text-brand-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-fg">Export Everything</p>
            <p className="text-xs text-slate-500 mt-0.5">One ZIP with every property, lease, tenant, task, financial record, and uploaded document.</p>
          </div>
        </div>
        <button
          onClick={handleExportBundle}
          disabled={loading === 'bundle' || done.has('bundle')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          {loading === 'bundle' ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Preparing…</>
          ) : done.has('bundle') ? (
            <><CheckCircle2 className="h-3.5 w-3.5" />Downloaded</>
          ) : (
            <><Download className="h-3.5 w-3.5" />Download ZIP</>
          )}
        </button>
      </div>

      <div className="mt-8 grid gap-4">
        {EXPORTS.map((item) => {
          const Icon = item.icon;
          const isLoading = loading === item.key;
          const isDone = done.has(item.key);
          return (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-xl border border-surface-400/40 bg-surface-100 px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-300/60">
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-fg">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                </div>
              </div>

              <button
                onClick={() => handleExport(item)}
                disabled={isLoading || isDone}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200 hover:bg-surface-300 disabled:opacity-60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors"
              >
                {isLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Exporting…</>
                ) : isDone ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-success" />Downloaded</>
                ) : (
                  <><Download className="h-3.5 w-3.5" />Download CSV</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-600">
        Exports reflect your current data. Large portfolios may take a few seconds to generate.
      </p>
    </div>
  );
}
