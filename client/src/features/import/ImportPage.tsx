import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, Download, CheckCircle, CheckCircle2, XCircle, AlertCircle,
  Building2, FileText, Paperclip, Sparkles, ChevronRight, ArrowLeft,
  Loader2,
} from 'lucide-react';
import { importService, parseCsvPreview, downloadTemplate, TEMPLATES, type ImportResult, type CsvPreview } from '@/services/import.service';
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

// ─── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  value: string;
  label: string;
  required: boolean;
  hint?: string;
}

const FIELD_DEFS: Record<CsvTab, FieldDef[]> = {
  properties: [
    { value: 'name',          label: 'Property Name',     required: true  },
    { value: 'code',          label: 'Property Code',     required: true,  hint: 'Unique ID used to link leases (e.g. roll number, APN)' },
    { value: 'type',          label: 'Type',              required: true,  hint: 'RESIDENTIAL · COMMERCIAL · MIXED_USE · INDUSTRIAL · RETAIL · OFFICE' },
    { value: 'address',       label: 'Street Address',    required: true  },
    { value: 'city',          label: 'City',              required: true  },
    { value: 'state',         label: 'State / Province',  required: true,  hint: '2-letter code (TX, ON, BC)' },
    { value: 'zipCode',       label: 'ZIP / Postal Code', required: true  },
    { value: 'totalUnits',    label: 'Total Units',       required: true  },
    { value: 'totalSqft',     label: 'Total Sq Ft',      required: false },
    { value: 'yearBuilt',     label: 'Year Built',        required: false },
    { value: 'purchasePrice', label: 'Purchase Price',    required: false },
    { value: 'currentValue',  label: 'Current Value',     required: false },
    { value: 'purchaseDate',  label: 'Purchase Date',     required: false },
    { value: 'country',       label: 'Country',           required: false },
  ],
  leases: [
    { value: 'propertyCode',    label: 'Property Code',    required: true,  hint: 'Must match an existing property' },
    { value: 'tenantName',      label: 'Tenant Name',      required: true  },
    { value: 'leaseNumber',     label: 'Lease Number',     required: true,  hint: 'Unique identifier' },
    { value: 'startDate',       label: 'Start Date',       required: true,  hint: 'YYYY-MM-DD' },
    { value: 'endDate',         label: 'End Date',         required: true,  hint: 'YYYY-MM-DD' },
    { value: 'baseRent',        label: 'Base Rent',        required: true,  hint: 'Monthly amount' },
    { value: 'tenantEmail',     label: 'Tenant Email',     required: false },
    { value: 'type',            label: 'Lease Type',       required: false, hint: 'GROSS · NET · MODIFIED_GROSS · PERCENTAGE · GROUND' },
    { value: 'unitNumber',      label: 'Unit Number',      required: false },
    { value: 'rentEscalation',  label: 'Rent Escalation',  required: false, hint: 'Annual rate (e.g. 0.03 = 3%)' },
    { value: 'securityDeposit', label: 'Security Deposit', required: false },
    { value: 'sqft',            label: 'Leased Sq Ft',    required: false },
    { value: 'notes',           label: 'Notes',            required: false },
  ],
};

// ─── Auto-suggest ─────────────────────────────────────────────────────────────

function norm(s: string) { return s.toLowerCase().replace(/[\s_\-.]+/g, ''); }

const PROP_ALIASES: Record<string, string> = {
  // name
  name: 'name', propertyname: 'name', buildingname: 'name', assetname: 'name', title: 'name', sitename: 'name',
  // code — includes Toronto RSN (Registration Serial Number) and common assessor IDs
  code: 'code', propertycode: 'code', propcode: 'code', rollnumber: 'code', roll: 'code',
  parcelid: 'code', apn: 'code', propertyid: 'code', assessmentrollnumber: 'code', pid: 'code',
  rsn: 'code', registrationserialnumber: 'code', serialnumber: 'code', registrationno: 'code',
  // type
  type: 'type', propertytype: 'type', assettype: 'type', usetype: 'type', landuse: 'type', useclass: 'type', propertyclass: 'type',
  // address
  address: 'address', streetaddress: 'address', addressfull: 'address', fulladdress: 'address',
  street: 'address', addressline1: 'address', civicaddress: 'address', siteaddress: 'address',
  // city
  city: 'city', municipality: 'city', town: 'city', cityname: 'city', locality: 'city',
  // state / province
  state: 'state', province: 'state', stateprovince: 'state', prov: 'state', statecode: 'state', provincecode: 'state',
  // zip / postal — includes Toronto PCODE
  zipcode: 'zipCode', zip: 'zipCode', postalcode: 'zipCode', postcode: 'zipCode', postal: 'zipCode', pcode: 'zipCode',
  // units — includes Toronto CONFIRMED_UNITS and NO_OF_UNITS
  totalunits: 'totalUnits', units: 'totalUnits', numunits: 'totalUnits', unitcount: 'totalUnits', totalsuites: 'totalUnits',
  confirmedunits: 'totalUnits', noofunits: 'totalUnits', nofunits: 'totalUnits', numberofunits: 'totalUnits',
  // sqft
  totalsqft: 'totalSqft', sqft: 'totalSqft', squarefeet: 'totalSqft', area: 'totalSqft',
  totalarea: 'totalSqft', gfa: 'totalSqft', grossfloorarea: 'totalSqft', buildingarea: 'totalSqft',
  // optional
  yearbuilt: 'yearBuilt', constructionyear: 'yearBuilt', builtyear: 'yearBuilt',
  purchaseprice: 'purchasePrice', acquisitionprice: 'purchasePrice',
  currentvalue: 'currentValue', assessedvalue: 'currentValue', marketvalue: 'currentValue', appraisedvalue: 'currentValue',
  purchasedate: 'purchaseDate', acquisitiondate: 'purchaseDate',
  country: 'country', countrycode: 'country',
};

const LEASE_ALIASES: Record<string, string> = {
  propertycode: 'propertyCode', propcode: 'propertyCode', property: 'propertyCode',
  tenantname: 'tenantName', tenant: 'tenantName', lessee: 'tenantName',
  leasenumber: 'leaseNumber', leaseno: 'leaseNumber', leaseid: 'leaseNumber', leaseref: 'leaseNumber',
  startdate: 'startDate', leasestart: 'startDate', commencement: 'startDate', commencementdate: 'startDate',
  enddate: 'endDate', leaseend: 'endDate', expiry: 'endDate', expirydate: 'endDate', expirationdate: 'endDate',
  baserent: 'baseRent', rent: 'baseRent', monthlyrent: 'baseRent', annualrent: 'baseRent', rentamount: 'baseRent',
  tenantemail: 'tenantEmail', email: 'tenantEmail',
  type: 'type', leasetype: 'type',
  unitnumber: 'unitNumber', unit: 'unitNumber', suite: 'unitNumber',
  rentescalation: 'rentEscalation', escalation: 'rentEscalation',
  securitydeposit: 'securityDeposit', deposit: 'securityDeposit',
  sqft: 'sqft', squarefeet: 'sqft', leasedarea: 'sqft',
  notes: 'notes', comments: 'notes', remarks: 'notes',
};

const TAB_ALIASES: Record<CsvTab, Record<string, string>> = { properties: PROP_ALIASES, leases: LEASE_ALIASES };

function autoSuggest(headers: string[], tab: CsvTab): Record<string, string> {
  const aliases = TAB_ALIASES[tab];
  const fields  = FIELD_DEFS[tab];
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    for (const h of headers) {
      if (aliases[norm(h)] === field.value) { mapping[field.value] = h; break; }
    }
  }
  return mapping;
}

// ─── Mapping view ─────────────────────────────────────────────────────────────

function MappingView({
  tab, preview, mapping, defaults, onChange, onDefaultsChange, onBack, onImport, loading, error,
}: {
  tab: CsvTab;
  preview: CsvPreview;
  mapping: Record<string, string>;  // valenceField → csvHeader
  defaults: Record<string, string>; // valenceField → fixed value
  onChange: (m: Record<string, string>) => void;
  onDefaultsChange: (d: Record<string, string>) => void;
  onBack: () => void;
  onImport: () => void;
  loading: boolean;
  error: string | null;
}) {
  const fields           = FIELD_DEFS[tab];
  const required         = fields.filter(f => f.required);
  const optional         = fields.filter(f => !f.required);
  // A required field is satisfied by either a CSV column OR a fixed default value
  const unmappedRequired = required.filter(f => !mapping[f.value] && !defaults[f.value]?.trim());
  const autoCount        = Object.values(mapping).filter(Boolean).length;
  const canImport        = unmappedRequired.length === 0;

  const row = (field: FieldDef) => {
    const selected   = mapping[field.value] ?? '';
    const fixedVal   = defaults[field.value] ?? '';
    const sampleVal  = selected ? preview.sample[selected] : '';
    const isSatisfied = selected || fixedVal.trim();
    return (
      <div key={field.value} className="grid grid-cols-2 gap-4 px-4 py-3 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-300 font-medium">{field.label}</span>
            {field.required
              ? <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', isSatisfied ? 'text-success bg-success/10 border-success/20' : 'text-red-400 bg-red-400/10 border-red-400/20')}>Required</span>
              : <span className="text-[10px] text-slate-600">Optional</span>}
          </div>
          {field.hint && <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">{field.hint}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <select
            value={selected}
            onChange={e => {
              onChange({ ...mapping, [field.value]: e.target.value });
              if (e.target.value) onDefaultsChange({ ...defaults, [field.value]: '' });
            }}
            className={cn(
              'w-full rounded-lg border bg-surface-200 px-2.5 py-1.5 text-sm outline-none transition-colors cursor-pointer',
              selected ? 'border-surface-400/40 text-white' : 'border-surface-400/40 text-slate-500',
            )}
          >
            <option value="">— Not mapped —</option>
            {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          {sampleVal && (
            <p className="text-[11px] text-slate-600 truncate" title={sampleVal}>e.g. &ldquo;{sampleVal}&rdquo;</p>
          )}
          {!selected && (
            <input
              type="text"
              value={fixedVal}
              onChange={e => onDefaultsChange({ ...defaults, [field.value]: e.target.value })}
              placeholder="or type a fixed value for all rows…"
              className="w-full rounded-lg border border-surface-400/30 bg-surface-200/50 px-2.5 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Banner */}
      <div className="flex items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-600/10 px-4 py-3">
        <Sparkles className="h-4 w-4 text-brand-400 shrink-0" />
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{autoCount} of {preview.headers.length} columns</span> auto-matched.
          {' '}For fields with no matching column, type a fixed value (e.g. <span className="text-white font-medium">Toronto</span> for City).
          {' '}
          <button onClick={onBack} className="text-brand-400 hover:text-brand-300 underline text-sm">Change file</button>
        </p>
      </div>

      {/* Mapping table */}
      <div className="rounded-xl border border-surface-400/30 overflow-hidden">
        <div className="grid grid-cols-2 gap-4 border-b border-surface-400/20 bg-surface-200/60 px-4 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Valence field</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your CSV column</p>
        </div>
        <div className="divide-y divide-surface-400/20 max-h-96 overflow-y-auto">
          {required.map(row)}
          {optional.length > 0 && (
            <div className="px-4 py-2 bg-surface-200/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Optional fields</p>
            </div>
          )}
          {optional.map(row)}
        </div>
      </div>

      {/* Validation warning */}
      {unmappedRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warning">
              {unmappedRequired.length} required field{unmappedRequired.length > 1 ? 's' : ''} not mapped
            </p>
            <p className="text-xs text-warning/70 mt-0.5">{unmappedRequired.map(f => f.label).join(' · ')}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Change file
        </button>
        <button
          onClick={onImport}
          disabled={!canImport || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : <><Upload className="h-4 w-4" /> Import {tab}</>}
        </button>
      </div>
    </div>
  );
}

// ─── CsvStep ──────────────────────────────────────────────────────────────────

type Phase = 'upload' | 'mapping' | 'done';

function CsvStep({
  tab,
  result,
  onResult,
}: {
  tab: CsvTab;
  result: ImportResult | null;
  onResult: (r: ImportResult) => void;
}) {
  const [phase,    setPhase]    = useState<Phase>(result ? 'done' : 'upload');
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<CsvPreview | null>(null);
  const [mapping,  setMapping]  = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    try {
      const prev = await parseCsvPreview(f);
      setFile(f);
      setPreview(prev);
      setMapping(autoSuggest(prev.headers, tab));
      setDefaults({});
      setPhase('mapping');
    } catch {
      setError('Could not read CSV headers — check the file is a valid UTF-8 CSV');
    }
  }, [tab]);

  const runImport = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const columnMap: Record<string, string> = {};
      for (const [valenceField, csvHeader] of Object.entries(mapping)) {
        if (csvHeader) columnMap[csvHeader] = valenceField;
      }
      const fixedDefaults: Record<string, string> = Object.fromEntries(
        Object.entries(defaults).filter(([, v]) => v.trim())
      );
      const res = await importService[tab](file, columnMap, Object.keys(fixedDefaults).length ? fixedDefaults : undefined);
      onResult(res);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const tpl = TEMPLATES[tab];

  // ── Done ──
  if (phase === 'done' && result) {
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

  // ── Mapping ──
  if (phase === 'mapping' && preview) {
    return (
      <MappingView
        tab={tab}
        preview={preview}
        mapping={mapping}
        defaults={defaults}
        onChange={setMapping}
        onDefaultsChange={setDefaults}
        onBack={() => { setPhase('upload'); setFile(null); setPreview(null); setError(null); setDefaults({}); }}
        onImport={runImport}
        loading={loading}
        error={error}
      />
    );
  }

  // ── Upload ──
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-surface-400/30 bg-surface-100/50 p-4">
        <div>
          <p className="text-sm font-semibold text-white mb-0.5">Download CSV template</p>
          <p className="text-xs text-slate-500 max-w-lg">{tpl.hint}</p>
        </div>
        <button
          onClick={() => downloadTemplate(tab)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-600/15 hover:bg-brand-600/25 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> {tpl.filename}
        </button>
      </div>

      <div
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
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
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">Drop a CSV file here</p>
          <p className="text-xs text-slate-600">or click to browse — we&apos;ll detect your columns automatically</p>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
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
