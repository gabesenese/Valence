import { useState, useRef, useCallback } from 'react';
import { Upload, Download, CheckCircle, XCircle, AlertCircle, Building2, Users, FileText } from 'lucide-react';
import { importService, downloadTemplate, TEMPLATES, type ImportResult } from '@/services/import.service';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

type Tab = 'properties' | 'tenants' | 'leases';

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'properties', label: 'Properties', icon: Building2 },
  { key: 'tenants',    label: 'Tenants',    icon: Users      },
  { key: 'leases',     label: 'Leases',     icon: FileText   },
];

interface ImportSectionProps {
  tab: Tab;
}

function ImportSection({ tab }: ImportSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const runImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await importService[tab](file);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const tpl = TEMPLATES[tab];

  return (
    <div className="flex flex-col gap-4">
      {/* Template download */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-surface-400/30 bg-surface-100/50 p-4">
        <div>
          <p className="text-sm font-semibold text-white mb-0.5">Download template</p>
          <p className="text-xs text-slate-500 max-w-lg">{tpl.hint}</p>
        </div>
        <button
          onClick={() => downloadTemplate(tab)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-600/15 hover:bg-brand-600/25 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          {tpl.filename}
        </button>
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition-colors',
            dragging
              ? 'border-brand-400 bg-brand-600/10'
              : 'border-surface-400/40 bg-surface-100/30 hover:border-brand-500/40 hover:bg-brand-600/5',
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300/60">
            <Upload className="h-5 w-5 text-slate-400" />
          </div>
          {file ? (
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB — click to change</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">Drop a CSV file here</p>
              <p className="text-xs text-slate-600">or click to browse</p>
            </div>
          )}
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onInputChange} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Action */}
      {file && !result && (
        <button
          onClick={runImport}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Importing…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Import {tab}
            </>
          )}
        </button>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Created',  value: result.created, icon: CheckCircle, color: 'text-success' },
              { label: 'Skipped',  value: result.skipped, icon: AlertCircle, color: 'text-warning'  },
              { label: 'Errors',   value: result.errors.length, icon: XCircle, color: 'text-danger' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-surface-400/30 bg-surface-100/50 py-4">
                <Icon className={cn('h-5 w-5', color)} />
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Error list */}
          {result.errors.length > 0 && (
            <div className="rounded-xl border border-surface-400/30 bg-surface-100/50 overflow-hidden">
              <div className="border-b border-surface-400/20 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Row errors</p>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-surface-400/20">
                {result.errors.map(({ row, message }) => (
                  <div key={row} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="shrink-0 rounded bg-surface-300/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                      Row {row}
                    </span>
                    <span className="text-xs text-slate-400">{message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={reset}
            className="self-start text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('properties');

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Import Data</h1>
        <p className="mt-0.5 text-sm text-slate-500">Bulk-upload properties, tenants, and leases from CSV files</p>
      </div>

      <Card>
        {/* Tab bar */}
        <div className="flex border-b border-surface-400/30">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === key
                  ? 'border-brand-400 text-brand-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <CardBody>
          <ImportSection key={activeTab} tab={activeTab} />
        </CardBody>
      </Card>
    </div>
  );
}
