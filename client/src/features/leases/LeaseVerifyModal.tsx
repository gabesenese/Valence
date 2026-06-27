import { useState, useRef, useCallback } from 'react';
import {
  Upload, AlertTriangle, Sparkles, CheckCircle2, XCircle, MinusCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { aiService, type LeaseVerificationResult, type LeaseFieldStatus } from '@/services/ai.service';


interface Props {
  open: boolean;
  onClose: () => void;
  leaseId: string;
}

type Stage = 'upload' | 'verifying' | 'result';

const STATUS_META: Record<LeaseFieldStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  match:               { icon: CheckCircle2, color: 'text-success', label: 'Match' },
  mismatch:            { icon: XCircle,      color: 'text-danger',  label: 'Differs' },
  missing_in_document: { icon: MinusCircle,  color: 'text-slate-600', label: 'Not in doc' },
};


export default function LeaseVerifyModal({ open, onClose, leaseId }: Props) {
  const [stage, setStage]     = useState<Stage>('upload');
  const [dragging, setDragging] = useState(false);
  const [file, setFile]       = useState<File | null>(null);
  const [result, setResult]   = useState<LeaseVerificationResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  function reset() {
    reqId.current++;
    setStage('upload');
    setFile(null);
    setResult(null);
    setError(null);
  }

  async function processFile(f: File) {
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      return;
    }
    const id = ++reqId.current;
    setFile(f);
    setError(null);
    setStage('verifying');
    try {
      const res = await aiService.verifyLeaseDocument(leaseId, f);
      if (reqId.current !== id) return; // closed/superseded — drop stale result
      setResult(res);
      setStage('result');
    } catch (e) {
      if (reqId.current !== id) return;
      setError((e as Error).message ?? 'Verification failed. Please try again.');
      setStage('upload');
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Verify Document Against Lease"
      className="max-w-xl"
    >
      <div className="px-5 py-5">

        {stage === 'upload' && (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Upload the signed agreement and Valence will read its key terms and
              compare them against this lease record — flagging anything that differs.
            </p>

            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-all ${
                dragging
                  ? 'border-brand-500/60 bg-brand-600/10'
                  : 'border-surface-400/50 bg-surface-200/30 hover:border-brand-500/30 hover:bg-surface-200/60'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 ring-1 ring-brand-500/20">
                <Upload className="h-5 w-5 text-brand-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">Drop the lease PDF here</p>
                <p className="mt-0.5 text-xs text-slate-600">or click to browse · PDF only · max 20 MB</p>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
            />

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}
          </>
        )}

        {stage === 'verifying' && (
          <div className="flex flex-col items-center gap-5 py-8">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-500" />
              <Sparkles className="h-6 w-6 text-brand-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-fg">Comparing document to lease…</p>
              <p className="mt-1 text-xs text-slate-500">
                Reading{file ? ` "${file.name}"` : ' your PDF'} and checking it against the stored terms
              </p>
            </div>
          </div>
        )}

        {stage === 'result' && result && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${
                result.mismatchCount > 0 ? 'bg-danger/20 ring-danger/30' : 'bg-success/20 ring-success/30'
              }`}>
                {result.mismatchCount > 0
                  ? <AlertTriangle className="h-5 w-5 text-danger" />
                  : <CheckCircle2 className="h-5 w-5 text-success" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">
                  {result.mismatchCount > 0
                    ? `${result.mismatchCount} field${result.mismatchCount > 1 ? 's' : ''} differ from the document`
                    : 'Document matches the lease record'}
                </p>
                <p className="text-xs text-slate-500">
                  {result.matchCount} matched · {result.mismatchCount} differ · {result.missingCount} not in document
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-surface-400/30 overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 border-b border-surface-400/30 bg-surface-200/60 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Field</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">In Valence</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">In document</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Status</span>
              </div>
              <div className="divide-y divide-surface-400/20 max-h-[46vh] overflow-y-auto">
                {result.comparisons.map((c) => {
                  const meta = STATUS_META[c.status];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={c.field}
                      className={`grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 items-center ${
                        c.status === 'mismatch' ? 'bg-danger/[0.04]' : ''
                      }`}
                    >
                      <span className="text-xs text-slate-400">{c.label}</span>
                      <span className="text-sm text-slate-200 truncate" title={c.stored ?? undefined}>
                        {c.stored ?? <span className="text-xs text-slate-700 italic">—</span>}
                      </span>
                      <span className={`text-sm truncate ${c.status === 'mismatch' ? 'text-danger' : 'text-slate-200'}`} title={c.extracted ?? undefined}>
                        {c.extracted ?? <span className="text-xs text-slate-700 italic">Not found</span>}
                      </span>
                      <span className={`flex items-center justify-end gap-1 text-[11px] font-medium ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{meta.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Nothing was changed. Open the lease to update any values that should match the signed document.
            </p>
          </>
        )}

      </div>

      <div className="flex items-center justify-between border-t border-surface-400/40 px-5 py-4">
        <Button variant="ghost" size="sm" onClick={() => { reset(); onClose(); }}>
          {stage === 'result' ? 'Done' : 'Close'}
        </Button>

        {stage === 'result' && (
          <Button variant="outline" size="sm" onClick={reset}>
            <Upload className="h-3.5 w-3.5" />
            Verify another
          </Button>
        )}

        {stage === 'upload' && (
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Browse files
          </Button>
        )}
      </div>
    </Modal>
  );
}
