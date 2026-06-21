import { useState } from 'react';
import { Download, Building2, FileText, Users, ClipboardList, Loader2, CheckCircle2 } from 'lucide-react';
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

  const handleExport = async (item: ExportItem) => {
    setLoading(item.key);
    try {
      const res = await api.get(item.endpoint, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename;
      a.click();
      URL.revokeObjectURL(url);
      setDone((prev) => new Set([...prev, item.key]));
      setTimeout(() => setDone((prev) => { const n = new Set(prev); n.delete(item.key); return n; }), 3000);
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
