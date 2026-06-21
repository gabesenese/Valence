import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertTriangle,
  Sparkles, ChevronRight,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { aiService, type ExtractedLease } from '@/services/ai.service';
import { formatCurrency } from '@/utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (extracted: ExtractedLease) => void;
}

type Stage = 'upload' | 'extracting' | 'review';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEASE_TYPE_LABEL: Record<string, string> = {
  GROSS: 'Gross', NET: 'Net', MODIFIED_GROSS: 'Modified Gross',
  PERCENTAGE: 'Percentage', GROUND: 'Ground Lease',
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Review row ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | null }) {
  const found = value !== null && value !== '';
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-surface-400/20 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 w-36">{label}</span>
      {found ? (
        <span className="text-sm text-slate-200 text-right">{value}</span>
      ) : (
        <span className="text-xs text-slate-700 italic">Not found</span>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeaseImportModal({ open, onClose, onConfirm }: Props) {
  const [stage, setStage]       = useState<Stage>('upload');
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ExtractedLease | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Sequence id for the in-flight extraction. Bumped on reset/close so a request
  // that resolves after the modal is closed can't apply its result to hidden state.
  const reqId = useRef(0);

  function reset() {
    reqId.current++;
    setStage('upload');
    setFile(null);
    setExtracted(null);
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
    setStage('extracting');
    try {
      const result = await aiService.extractLease(f);
      if (reqId.current !== id) return; // closed/superseded — drop stale result
      setExtracted(result);
      setStage('review');
    } catch (e) {
      if (reqId.current !== id) return;
      setError((e as Error).message ?? 'Extraction failed. Please try again.');
      setStage('upload');
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  function countFound(e: ExtractedLease) {
    const fields: (keyof ExtractedLease)[] = [
      'tenantName', 'propertyAddress', 'unitNumber', 'startDate', 'endDate',
      'baseRent', 'rentEscalation', 'securityDeposit', 'sqft', 'leaseType',
      'renewalOptions', 'obligations', 'notes',
    ];
    return fields.filter((k) => e[k] !== null && e[k] !== '').length;
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Import Lease from PDF"
      className="max-w-xl"
    >
      <div className="px-5 py-5">

        {/* ── Upload stage ──────────────────────────────────────────────── */}
        {stage === 'upload' && (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Upload a signed lease PDF. Claude will extract the key terms and
              pre-fill the lease record — you'll review before anything is saved.
            </p>

            {/* Drop zone */}
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
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
                <p className="text-sm font-medium text-slate-300">Drop your lease PDF here</p>
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

        {/* ── Extracting stage ──────────────────────────────────────────── */}
        {stage === 'extracting' && (
          <div className="flex flex-col items-center gap-5 py-8">
            {/* Animated ring */}
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-500" />
              <Sparkles className="h-6 w-6 text-brand-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-fg">Analyzing lease document…</p>
              <p className="mt-1 text-xs text-slate-500">
                Claude is reading{file ? ` "${file.name}"` : ' your PDF'} and extracting key terms
              </p>
            </div>
            {/* Simulated progress items */}
            <div className="w-full max-w-xs space-y-1.5">
              {['Reading document', 'Identifying parties', 'Extracting financial terms', 'Parsing renewal clauses'].map((s, i) => (
                <div key={s} className="flex items-center gap-2 text-xs text-slate-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-500/60 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Review stage ──────────────────────────────────────────────── */}
        {stage === 'review' && extracted && (() => {
          const found = countFound(extracted);
          const total = 13;
          return (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 ring-1 ring-success/30">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">Extraction complete</p>
                  <p className="text-xs text-slate-500">{found} of {total} fields found{file ? ` from "${file.name}"` : ''}</p>
                </div>
                <div className="ml-auto h-1.5 w-24 rounded-full bg-surface-400/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{ width: `${Math.round((found / total) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Fields */}
              <div className="rounded-xl border border-surface-400/30 bg-surface-200/20 px-4 divide-y-0 max-h-[46vh] overflow-y-auto">
                <Row label="Tenant"           value={extracted.tenantName} />
                <Row label="Property Address" value={extracted.propertyAddress} />
                <Row label="Unit / Suite"     value={extracted.unitNumber} />
                <Row label="Lease Type"       value={extracted.leaseType ? LEASE_TYPE_LABEL[extracted.leaseType] ?? extracted.leaseType : null} />
                <Row label="Start Date"       value={formatDate(extracted.startDate)} />
                <Row label="End Date"         value={formatDate(extracted.endDate)} />
                <Row label="Monthly Rent"     value={extracted.baseRent ? formatCurrency(extracted.baseRent) + '/mo' : null} />
                <Row label="Escalation"       value={extracted.rentEscalation ? `+${extracted.rentEscalation}% / yr` : null} />
                <Row label="Security Deposit" value={extracted.securityDeposit ? formatCurrency(extracted.securityDeposit) : null} />
                <Row label="Sq. Ft."          value={extracted.sqft ? extracted.sqft.toLocaleString() : null} />
                <Row label="Renewal Options"  value={extracted.renewalOptions} />
                <Row label="Obligations"      value={extracted.obligations} />
                <Row label="Notes"            value={extracted.notes} />
              </div>

              <p className="mt-3 text-xs text-slate-600">
                You'll be able to review and edit all fields before the lease is saved.
              </p>
            </>
          );
        })()}

      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-surface-400/40 px-5 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { reset(); onClose(); }}
        >
          {stage === 'review' ? 'Cancel' : 'Close'}
        </Button>

        {stage === 'review' && extracted && (
          <Button
            size="sm"
            onClick={() => { onConfirm(extracted); reset(); onClose(); }}
          >
            <FileText className="h-3.5 w-3.5" />
            Create Lease
            <ChevronRight className="h-3.5 w-3.5" />
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
