import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, Download, CheckCircle, CheckCircle2, XCircle, AlertCircle,
  Building2, FileText, Paperclip, Sparkles, ChevronRight, ArrowLeft,
  Loader2,
} from 'lucide-react';
import { importService, downloadTemplate, TEMPLATES, type ImportResult } from '@/services/import.service';
import { documentsService } from '@/services/documents.service';
import { analyticsService } from '@/services/analytics.service';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import { PageHeader } from '@/components/ui/PageHeader';

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'properties' as const,   label: 'Properties',   icon: Building2  },
  { id: 'leases' as const,       label: 'Leases',       icon: FileText   },
  { id: 'documents' as const,    label: 'Documents',    icon: Paperclip  },
  { id: 'intelligence' as const, label: 'Intelligence', icon: Sparkles   },
];
type StepId = typeof STEPS[number]['id'];

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done    = i < current;
        const active  = i === current;
        const Icon    = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              done   ? 'text-success'          : '',
              active ? 'bg-brand-600/20 text-brand-300' : '',
              !done && !active ? 'text-slate-600' : '',
            )}>
              {done
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-400' : 'text-slate-600')} />}
              <span className="hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className={cn('h-3.5 w-3.5 mx-1', i < current ? 'text-slate-500' : 'text-slate-700')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CSV Import step (shared for properties + leases) ─────────────────────────

type CsvTab = 'properties' | 'leases';

function CsvStep({
  tab,
  result,
  onResult,
}: {
  tab: CsvTab;
  result: ImportResult | null;
  onResult: (r: ImportResult) => void;
}) {
  const [file, setFile]       = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => { setFile(f); setError(null); };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const runImport = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const res = await importService[tab](file);
      onResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const tpl = TEMPLATES[tab];

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Created', value: result.created,        icon: CheckCircle, color: 'text-success' },
            { label: 'Skipped', value: result.skipped,        icon: AlertCircle, color: 'text-warning'  },
            { label: 'Errors',  value: result.errors.length,  icon: XCircle,     color: 'text-danger'   },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-surface-400/30 bg-surface-100/50 py-4">
              <Icon className={cn('h-5 w-5', color)} />
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        {result.errors.length > 0 && (
          <div className="rounded-xl border border-surface-400/30 bg-surface-100/50 overflow-hidden">
            <div className="border-b border-surface-400/20 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Row errors</p>
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-surface-400/20">
              {result.errors.map(({ row, message }) => (
                <div key={row} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="shrink-0 rounded bg-surface-300/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">Row {row}</span>
                  <span className="text-xs text-slate-400">{message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">
          {result.created > 0 ? `${result.created} ${tab} imported successfully.` : 'No records were imported.'}{' '}
          Continue to the next step or go back to re-import.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Template download */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-surface-400/30 bg-surface-100/50 p-4">
        <div>
          <p className="text-sm font-semibold text-white mb-0.5">Download CSV template</p>
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
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition-colors',
          dragging ? 'border-brand-400 bg-brand-600/10' : 'border-surface-400/40 bg-surface-100/30 hover:border-brand-500/40 hover:bg-brand-600/5',
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300/60">
          <Upload className="h-5 w-5 text-slate-400" />
        </div>
        {file ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-white">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · click to change</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">Drop a CSV file here</p>
            <p className="text-xs text-slate-600">or click to browse</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {file && (
        <button
          onClick={runImport}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
            : <><Upload className="h-4 w-4" /> Import {tab}</>}
        </button>
      )}
    </div>
  );
}

// ─── Documents step ───────────────────────────────────────────────────────────

function DocumentsStep({ count, onCount }: { count: number; onCount: (n: number) => void }) {
  const [files, setFiles]       = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(count);
  const [errors, setErrors]     = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) => setFiles((prev) => [...prev, ...incoming]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, []);

  const uploadAll = async () => {
    if (!files.length) return;
    setUploading(true);
    const errs: string[] = [];
    let ok = 0;
    for (const f of files) {
      try {
        await documentsService.uploadDocument(f, { type: 'OTHER', name: f.name });
        ok++;
      } catch {
        errs.push(f.name);
      }
    }
    const total = uploaded + ok;
    setUploaded(total);
    onCount(total);
    setFiles([]);
    setErrors(errs);
    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-surface-400/30 bg-surface-100/50 p-4">
        <p className="text-sm font-semibold text-white mb-0.5">Upload lease documents</p>
        <p className="text-xs text-slate-500">
          PDFs, images, and Word documents. Lease agreements, insurance certificates, permits, and amendments.
          You can associate files with specific properties and leases from the Documents page.
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors',
          dragging ? 'border-brand-400 bg-brand-600/10' : 'border-surface-400/40 bg-surface-100/30 hover:border-brand-500/40 hover:bg-brand-600/5',
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300/60">
          <Paperclip className="h-5 w-5 text-slate-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">Drop files here</p>
          <p className="text-xs text-slate-600">PDF · DOCX · PNG · JPG</p>
        </div>
        <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
      </div>

      {files.length > 0 && (
        <div className="rounded-xl border border-surface-400/30 bg-surface-100/50 overflow-hidden">
          <div className="border-b border-surface-400/20 px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{files.length} file{files.length !== 1 ? 's' : ''} ready</p>
            <button onClick={() => setFiles([])} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Clear</button>
          </div>
          <div className="max-h-40 overflow-y-auto divide-y divide-surface-400/20">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <span className="flex-1 truncate text-xs text-slate-400">{f.name}</span>
                <span className="text-xs text-slate-600">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3">
          <p className="text-xs font-semibold text-danger mb-1">Failed to upload:</p>
          {errors.map((e) => <p key={e} className="text-xs text-danger/80">{e}</p>)}
        </div>
      )}

      {uploaded > 0 && (
        <div className="flex items-center gap-2 text-xs text-success">
          <CheckCircle2 className="h-4 w-4" />
          {uploaded} document{uploaded !== 1 ? 's' : ''} uploaded successfully
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={uploadAll}
          disabled={uploading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
            : <><Upload className="h-4 w-4" /> Upload {files.length} file{files.length !== 1 ? 's' : ''}</>}
        </button>
      )}
    </div>
  );
}

// ─── Intelligence step ────────────────────────────────────────────────────────

const COMPUTE_ITEMS = [
  'Calculating portfolio health score',
  'Running renewal risk analysis',
  'Generating operational insights',
  'Scanning for anomalies & alerts',
  'Building benchmarks',
];

function IntelligenceStep() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [phase, setPhase]       = useState<'computing' | 'ready'>('computing');
  const [doneCount, setDoneCount] = useState(0);
  const [summary, setSummary]   = useState<{ properties: number; leases: number; alerts: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Stagger the "computed" items
      for (let i = 0; i < COMPUTE_ITEMS.length; i++) {
        await new Promise((r) => setTimeout(r, 600 + i * 400));
        if (cancelled) return;
        setDoneCount(i + 1);
      }

      // Fetch real summary to show accurate numbers
      try {
        const s = await analyticsService.getSummary();
        if (!cancelled) setSummary({ properties: s.properties.total, leases: s.leases.active, alerts: s.alerts.open });
      } catch { /* show without numbers */ }

      qc.invalidateQueries();
      if (!cancelled) setPhase('ready');
    };

    void run();
    return () => { cancelled = true; };
  }, [qc]);

  if (phase === 'computing') {
    return (
      <div className="flex flex-col items-center gap-8 py-10">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand-600/20 border-t-brand-400" />
          <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-brand-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">Generating portfolio intelligence…</p>
          <p className="mt-1 text-sm text-slate-500">Analyzing your properties, leases, and financial data</p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2.5">
          {COMPUTE_ITEMS.map((item, i) => (
            <div key={item} className="flex items-center gap-3">
              {i < doneCount
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                : i === doneCount
                ? <Loader2 className="h-4 w-4 shrink-0 text-brand-400 animate-spin" />
                : <div className="h-4 w-4 shrink-0 rounded-full border border-surface-400/40" />}
              <span className={cn('text-sm transition-colors', i < doneCount ? 'text-slate-400' : i === doneCount ? 'text-white' : 'text-slate-600')}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 border border-success/20">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">Your portfolio is ready</p>
        <p className="mt-1.5 text-sm text-slate-400">Health score, alerts, and benchmarks are now live.</p>
      </div>
      {summary && (
        <div className="flex gap-6">
          {[
            { label: 'Properties', value: summary.properties },
            { label: 'Active leases', value: summary.leases },
            { label: 'Open alerts', value: summary.alerts },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => navigate('/queue')}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-colors"
      >
        View Portfolio Dashboard <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface WizardState {
  properties: ImportResult | null;
  leases:     ImportResult | null;
  documents:  number;
}

const STEP_DESCRIPTIONS: Record<StepId, string> = {
  properties:  'Import your property portfolio from a CSV file',
  leases:      'Import lease agreements and link them to properties',
  documents:   'Upload lease documents, insurance files, and permits',
  intelligence: 'Computing your portfolio health score and insights',
};

export default function ImportPage() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({ properties: null, leases: null, documents: 0 });

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const canContinue = (() => {
    if (current.id === 'properties')  return state.properties !== null;
    if (current.id === 'leases')      return state.leases !== null;
    if (current.id === 'documents')   return true; // always skippable
    return false;
  })();

  const stepLabel = current.id === 'intelligence'
    ? null
    : `Step ${step + 1} of ${STEPS.length - 1}`;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Import Wizard"
        description={stepLabel ?? 'Generating portfolio intelligence'}
      />

      <Card>
        {/* Stepper bar */}
        <div className="flex items-center justify-between border-b border-surface-400/30 px-5 py-3">
          <Stepper current={step} />
        </div>

        <CardBody>
          {/* Step header */}
          {current.id !== 'intelligence' && (
            <div className="mb-6">
              <h2 className="text-base font-semibold text-white">{current.label}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{STEP_DESCRIPTIONS[current.id]}</p>
            </div>
          )}

          {/* Step content */}
          {current.id === 'properties' && (
            <CsvStep
              tab="properties"
              result={state.properties}
              onResult={(r) => setState((s) => ({ ...s, properties: r }))}
            />
          )}
          {current.id === 'leases' && (
            <CsvStep
              tab="leases"
              result={state.leases}
              onResult={(r) => setState((s) => ({ ...s, leases: r }))}
            />
          )}
          {current.id === 'documents' && (
            <DocumentsStep
              count={state.documents}
              onCount={(n) => setState((s) => ({ ...s, documents: n }))}
            />
          )}
          {current.id === 'intelligence' && <IntelligenceStep />}
        </CardBody>

        {/* Footer navigation */}
        {current.id !== 'intelligence' && (
          <div className="flex items-center justify-between border-t border-surface-400/30 px-5 py-4">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              {!canContinue && (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Skip for now
                </button>
              )}
              {(canContinue || isLastStep) && (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  {step === STEPS.length - 2 ? 'Generate Intelligence' : 'Continue'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
