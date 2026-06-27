import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, Download, CheckCircle, CheckCircle2, XCircle, AlertCircle,
  Building2, FileText, Paperclip, Sparkles, ChevronRight, ArrowLeft,
  Loader2, TrendingUp, BookOpen, ChevronDown, Info, Zap, ArrowRight, Wallet,
} from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@valence/shared';
import { importService, parseCsvPreview, downloadTemplate, TEMPLATES, type ImportResult, type CsvPreview } from '@/services/import.service';
import { documentsService } from '@/services/documents.service';
import { analyticsService } from '@/services/analytics.service';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import { PageHeader } from '@/components/ui/PageHeader';


const STEPS = [
  { id: 'properties' as const,   label: 'Properties',   icon: Building2  },
  { id: 'leases' as const,       label: 'Leases',       icon: FileText   },
  { id: 'expenses' as const,     label: 'Expenses',     icon: Wallet     },
  { id: 'documents' as const,    label: 'Documents',    icon: Paperclip  },
  { id: 'intelligence' as const, label: 'Intelligence', icon: Sparkles   },
];
type StepId = typeof STEPS[number]['id'];

type ImportTab = 'properties' | 'leases' | 'expenses';


const SPLASH_KEY = 'valence-import-seen-v1';

function SplashScreen({ onStart }: { onStart: () => void }) {
  const go = () => {
    localStorage.setItem(SPLASH_KEY, '1');
    onStart();
  };

  const CHECKLIST = [
    { label: 'A CSV of your properties', sub: 'name, code, address, city, state, zip, units' },
    { label: 'A CSV of your leases', sub: 'property code, tenant, start/end dates, rent' },
    { label: 'Lease documents (optional)', sub: 'PDF, DOCX — you can add these after' },
  ];

  const ORDER = [
    { num: 1, title: 'Properties first', desc: 'Leases reference property codes — properties must exist before leases.' },
    { num: 2, title: 'Leases second', desc: 'Tenants are created automatically from your lease CSV. No separate step needed.' },
    { num: 3, title: 'Documents last', desc: 'Attach lease agreements, certificates, and permits after importing data.' },
  ];

  return (
    <div className="flex flex-col gap-8 p-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600/15 border border-brand-500/20">
          <Upload className="h-8 w-8 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-fg">Import your portfolio</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-md">
            Bring your properties, leases, and tenants into Valence in minutes.
            Your CSV doesn't need to match our format exactly — we'll auto-detect your columns.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <h3 className="text-sm font-semibold text-fg">What to prepare</h3>
            </div>
            <div className="flex flex-col gap-3">
              {CHECKLIST.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-success/50 bg-success/10" />
                  <div>
                    <p className="text-sm text-slate-300 font-medium">{item.label}</p>
                    <p className="text-xs text-slate-600">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => downloadTemplate('properties')} className="inline-flex items-center gap-1 rounded-lg border border-surface-400/30 bg-surface-200/60 hover:bg-surface-200 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                <Download className="h-3 w-3" /> Properties CSV
              </button>
              <button onClick={() => downloadTemplate('leases')} className="inline-flex items-center gap-1 rounded-lg border border-surface-400/30 bg-surface-200/60 hover:bg-surface-200 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                <Download className="h-3 w-3" /> Leases CSV
              </button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-fg">Recommended order</h3>
            </div>
            <div className="flex flex-col gap-3">
              {ORDER.map((item) => (
                <div key={item.num} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-[11px] font-bold text-brand-300">{item.num}</span>
                  <div>
                    <p className="text-sm text-slate-300 font-medium">{item.title}</p>
                    <p className="text-xs text-slate-600 leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="rounded-xl border border-surface-400/30 bg-surface-100/40 px-5 py-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
            {[
              { q: 'My columns have different names', a: 'No problem — the mapper auto-detects common aliases. You can manually adjust anything it misses.' },
              { q: 'Some fields are missing in my CSV', a: "Set a fixed default value for the whole import — e.g. set Country to 'CA' if your CSV doesn't have that column." },
              { q: 'What if I re-import the same data?', a: "Safe — existing records are updated by code/ID, not duplicated. Only new rows create new records." },
            ].map((item) => (
              <div key={item.q}>
                <p className="text-xs font-semibold text-slate-300">{item.q}</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={go}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-8 py-3 text-sm font-semibold text-white transition-colors"
        >
          Start Import <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


interface FieldDef {
  value: string;
  label: string;
  required: boolean;
  hint?: string;
  placeholder?: string;    // smart default hint for fixed-value input
  enumValues?: string[];   // if set, show a select instead of text input
  docExample?: string;     // shown in docs panel
  docFormat?: string;      // shown in docs panel
}

const FIELD_DEFS: Record<ImportTab, FieldDef[]> = {
  properties: [
    { value: 'name',          label: 'Property Name',     required: true,  placeholder: 'e.g. Sunset Office Tower',       docFormat: 'Any text',           docExample: 'Sunset Office Tower' },
    { value: 'code',          label: 'Property Code',     required: true,  placeholder: 'e.g. APN-1234',                  docFormat: 'Unique text/number',  docExample: 'APN-1234', hint: 'Unique ID used to link leases (roll number, APN, PID)' },
    { value: 'type',          label: 'Type',              required: true,  placeholder: 'e.g. COMMERCIAL',                docFormat: 'Enum (see values)',   docExample: 'COMMERCIAL',
      enumValues: ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'RETAIL', 'OFFICE'],
      hint: 'RESIDENTIAL · COMMERCIAL · MIXED_USE · INDUSTRIAL · RETAIL · OFFICE' },
    { value: 'address',       label: 'Street Address',    required: true,  placeholder: 'e.g. 123 Main St',               docFormat: 'Street address',      docExample: '123 Main St' },
    { value: 'city',          label: 'City',              required: true,  placeholder: 'e.g. Toronto',                   docFormat: 'City name',           docExample: 'Toronto' },
    { value: 'state',         label: 'State / Province',  required: true,  placeholder: 'e.g. ON or BC',                  docFormat: '2-letter code',       docExample: 'ON', hint: '2-letter code (ON, BC, AB)' },
    { value: 'zipCode',       label: 'ZIP / Postal Code', required: true,  placeholder: 'e.g. M5V 3A8',                   docFormat: 'ZIP or postal',       docExample: 'M5V 3A8' },
    { value: 'totalUnits',    label: 'Total Units',       required: true,  placeholder: 'e.g. 24',                        docFormat: 'Integer',             docExample: '24' },
    { value: 'totalSqft',     label: 'Total Sq Ft',       required: false, placeholder: 'e.g. 18500',                     docFormat: 'Number',              docExample: '18500' },
    { value: 'yearBuilt',     label: 'Year Built',        required: false, placeholder: 'e.g. 1998',                      docFormat: '4-digit year',        docExample: '1998' },
    { value: 'purchasePrice', label: 'Purchase Price',    required: false, placeholder: 'e.g. 4500000',                   docFormat: 'Number (no commas)',  docExample: '4500000' },
    { value: 'currentValue',  label: 'Current Value',     required: false, placeholder: 'e.g. 5200000',                   docFormat: 'Number (no commas)',  docExample: '5200000' },
    { value: 'purchaseDate',  label: 'Purchase Date',     required: false, placeholder: 'e.g. 2019-03-15',                docFormat: 'YYYY-MM-DD',          docExample: '2019-03-15' },
    { value: 'country',       label: 'Country',           required: false, placeholder: 'e.g. CA',                        docFormat: '2-letter ISO code',   docExample: 'CA' },
  ],
  leases: [
    { value: 'propertyCode',    label: 'Property Code',    required: true,  placeholder: 'e.g. APN-1234',                  docFormat: 'Must match existing property', docExample: 'APN-1234',  hint: 'Must match an existing property code' },
    { value: 'tenantName',      label: 'Tenant Name',      required: true,  placeholder: 'e.g. Acme Corp',                 docFormat: 'Any text',            docExample: 'Acme Corp' },
    { value: 'leaseNumber',     label: 'Lease Number',     required: true,  placeholder: 'e.g. LSE-2024-001',              docFormat: 'Unique per property', docExample: 'LSE-2024-001', hint: 'Unique identifier per property' },
    { value: 'startDate',       label: 'Start Date',       required: true,  placeholder: 'e.g. 2024-01-01',                docFormat: 'YYYY-MM-DD',          docExample: '2024-01-01',  hint: 'YYYY-MM-DD format' },
    { value: 'endDate',         label: 'End Date',         required: true,  placeholder: 'e.g. 2026-12-31',                docFormat: 'YYYY-MM-DD',          docExample: '2026-12-31',  hint: 'YYYY-MM-DD format' },
    { value: 'baseRent',        label: 'Base Rent',        required: true,  placeholder: 'e.g. 3500',                      docFormat: 'Monthly $ (no commas)', docExample: '3500',       hint: 'Monthly amount in dollars' },
    { value: 'tenantEmail',     label: 'Tenant Email',     required: false, placeholder: 'e.g. tenant@company.com',        docFormat: 'Email address',       docExample: 'tenant@company.com' },
    { value: 'type',            label: 'Lease Type',       required: false, placeholder: 'e.g. GROSS',                     docFormat: 'Enum (see values)',   docExample: 'GROSS',
      enumValues: ['GROSS', 'NET', 'MODIFIED_GROSS', 'PERCENTAGE', 'GROUND'],
      hint: 'GROSS · NET · MODIFIED_GROSS · PERCENTAGE · GROUND' },
    { value: 'unitNumber',      label: 'Unit Number',      required: false, placeholder: 'e.g. Suite 301',                 docFormat: 'Any text',            docExample: 'Suite 301' },
    { value: 'rentEscalation',  label: 'Rent Escalation',  required: false, placeholder: 'e.g. 0.03 (= 3%)',              docFormat: 'Decimal rate',        docExample: '0.03',       hint: 'Annual rate e.g. 0.03 = 3%' },
    { value: 'securityDeposit', label: 'Security Deposit', required: false, placeholder: 'e.g. 7000',                      docFormat: 'Number (no commas)',  docExample: '7000' },
    { value: 'sqft',            label: 'Leased Sq Ft',     required: false, placeholder: 'e.g. 2400',                      docFormat: 'Number',              docExample: '2400' },
    { value: 'lateFeeType',     label: 'Late Fee Type',    required: false, placeholder: 'e.g. PERCENTAGE',                docFormat: 'Enum (see values)',   docExample: 'PERCENTAGE',
      enumValues: ['NONE', 'FLAT', 'PERCENTAGE'],
      hint: 'NONE · FLAT (fixed $) · PERCENTAGE (% of rent)' },
    { value: 'lateFeeFlat',     label: 'Late Fee (Flat)',  required: false, placeholder: 'e.g. 75',                        docFormat: 'Number (no commas)',  docExample: '75',         hint: 'Fixed dollar fee — used when Late Fee Type is FLAT' },
    { value: 'lateFeePercent',  label: 'Late Fee (%)',     required: false, placeholder: 'e.g. 5',                         docFormat: 'Percent 0–100',       docExample: '5',          hint: '% of rent — used when Late Fee Type is PERCENTAGE' },
    { value: 'lateFeeGraceDays',label: 'Grace Period (days)', required: false, placeholder: 'e.g. 5',                      docFormat: 'Integer 0–90',        docExample: '5' },
    { value: 'lateFeeInterestPct', label: 'Monthly Interest (%)', required: false, placeholder: 'e.g. 1.5',               docFormat: 'Percent 0–100',       docExample: '1.5',        hint: 'Monthly interest on overdue balance' },
    { value: 'notes',           label: 'Notes',            required: false, placeholder: 'e.g. Month-to-month renewal',    docFormat: 'Any text',            docExample: 'Month-to-month renewal' },
  ],
  expenses: [
    { value: 'propertyCode', label: 'Property Code', required: true,  placeholder: 'e.g. APN-1234',     docFormat: 'Must match existing property', docExample: 'APN-1234', hint: 'Must match an existing property code' },
    { value: 'date',         label: 'Date',          required: true,  placeholder: 'e.g. 2026-01-15',   docFormat: 'YYYY-MM-DD',          docExample: '2026-01-15', hint: 'The expense date / period' },
    { value: 'amount',       label: 'Amount',        required: true,  placeholder: 'e.g. 1200',         docFormat: 'Number (no commas)',  docExample: '1200' },
    { value: 'category',     label: 'Category',      required: false, placeholder: 'e.g. UTILITIES',    docFormat: 'Enum (see values)',   docExample: 'UTILITIES',
      enumValues: EXPENSE_CATEGORIES.map((c) => c.value),
      hint: 'Defaults to OTHER if blank or unrecognized' },
    { value: 'description',  label: 'Description',    required: false, placeholder: 'e.g. Q1 hydro bill', docFormat: 'Any text',           docExample: 'Q1 hydro bill' },
    { value: 'dueDate',      label: 'Due Date',      required: false, placeholder: 'e.g. 2026-02-01',   docFormat: 'YYYY-MM-DD',          docExample: '2026-02-01' },
  ],
};


function norm(s: string) { return s.toLowerCase().replace(/[\s_\-.]+/g, ''); }

const PROP_ALIASES: Record<string, string> = {
  name: 'name', propertyname: 'name', buildingname: 'name', assetname: 'name', title: 'name', sitename: 'name',
  code: 'code', propertycode: 'code', propcode: 'code', rollnumber: 'code', roll: 'code',
  parcelid: 'code', apn: 'code', propertyid: 'code', assessmentrollnumber: 'code', pid: 'code',
  rsn: 'code', registrationserialnumber: 'code', serialnumber: 'code', registrationno: 'code',
  type: 'type', propertytype: 'type', assettype: 'type', usetype: 'type', landuse: 'type', useclass: 'type', propertyclass: 'type',
  address: 'address', streetaddress: 'address', addressfull: 'address', fulladdress: 'address',
  street: 'address', addressline1: 'address', civicaddress: 'address', siteaddress: 'address',
  city: 'city', municipality: 'city', town: 'city', cityname: 'city', locality: 'city',
  state: 'state', province: 'state', stateprovince: 'state', prov: 'state', statecode: 'state', provincecode: 'state',
  zipcode: 'zipCode', zip: 'zipCode', postalcode: 'zipCode', postcode: 'zipCode', postal: 'zipCode', pcode: 'zipCode',
  totalunits: 'totalUnits', units: 'totalUnits', numunits: 'totalUnits', unitcount: 'totalUnits', totalsuites: 'totalUnits',
  confirmedunits: 'totalUnits', noofunits: 'totalUnits', nofunits: 'totalUnits', numberofunits: 'totalUnits',
  totalsqft: 'totalSqft', squarefeet: 'totalSqft', area: 'totalSqft',
  totalarea: 'totalSqft', gfa: 'totalSqft', grossfloorarea: 'totalSqft', buildingarea: 'totalSqft',
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
  latefeetype: 'lateFeeType', latefee: 'lateFeeType',
  latefeeflat: 'lateFeeFlat', flatlatefee: 'lateFeeFlat', latefeeamount: 'lateFeeFlat',
  latefeepercent: 'lateFeePercent', latefeepct: 'lateFeePercent',
  latefeegracedays: 'lateFeeGraceDays', gracedays: 'lateFeeGraceDays', graceperiod: 'lateFeeGraceDays',
  latefeeinterestpct: 'lateFeeInterestPct', interestrate: 'lateFeeInterestPct', interest: 'lateFeeInterestPct',
  notes: 'notes', comments: 'notes', remarks: 'notes',
};

const EXPENSE_ALIASES: Record<string, string> = {
  propertycode: 'propertyCode', propcode: 'propertyCode', property: 'propertyCode',
  date: 'date', expensedate: 'date', period: 'date', postingdate: 'date', transactiondate: 'date', paiddate: 'date',
  amount: 'amount', cost: 'amount', total: 'amount', expense: 'amount', value: 'amount', paid: 'amount',
  category: 'category', expensetype: 'category', glcode: 'category', account: 'category', expensecategory: 'category',
  description: 'description', memo: 'description', details: 'description', vendor: 'description', payee: 'description',
  duedate: 'dueDate', due: 'dueDate',
};

const TAB_ALIASES: Record<ImportTab, Record<string, string>> = { properties: PROP_ALIASES, leases: LEASE_ALIASES, expenses: EXPENSE_ALIASES };

function autoSuggest(headers: string[], tab: ImportTab): Record<string, string> {
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


function DocsPanel({ tab }: { tab: ImportTab }) {
  const [open, setOpen] = useState(false);
  const fields = FIELD_DEFS[tab];

  return (
    <div className="rounded-xl border border-surface-400/30 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-surface-200/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-400">Field reference & examples</span>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-slate-600 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-surface-400/20 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-400/20 bg-surface-200/40">
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-36">Field</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">Required</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Format</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-400/10">
              {fields.map((f) => (
                <tr key={f.value} className="hover:bg-surface-200/20">
                  <td className="px-4 py-2 font-mono text-slate-300">{f.value}</td>
                  <td className="px-4 py-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', f.required ? 'bg-danger/10 text-danger' : 'bg-surface-300/40 text-slate-600')}>
                      {f.required ? 'Required' : 'Optional'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{f.docFormat ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-slate-400">{f.docExample ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        const Icon   = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              done   ? 'text-success' : '',
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


function SmartDefaultInput({ field, value, onChange }: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.enumValues) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-surface-400/30 bg-surface-200/50 px-2.5 py-1.5 text-sm text-slate-300 outline-none focus:border-brand-500/50 transition-colors cursor-pointer"
      >
        <option value="">— Select a default —</option>
        {field.enumValues.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? `Fixed value for all rows…`}
      className="w-full rounded-lg border border-surface-400/30 bg-surface-200/50 px-2.5 py-1.5 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-brand-500/50 transition-colors"
    />
  );
}


function MissingFieldPrompt({ field, defaults, onDefaultsChange }: {
  field: FieldDef;
  defaults: Record<string, string>;
  onDefaultsChange: (d: Record<string, string>) => void;
}) {
  return (
    <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
        <p className="text-xs font-semibold text-warning">
          <span className="font-bold">{field.label}</span> is required and not mapped to a column.
          Set a fixed default below, or go back and map it.
        </p>
      </div>
      {field.hint && (
        <p className="text-[11px] text-slate-600 pl-5">{field.hint}</p>
      )}
      <div className="pl-5">
        <SmartDefaultInput
          field={field}
          value={defaults[field.value] ?? ''}
          onChange={(v) => onDefaultsChange({ ...defaults, [field.value]: v })}
        />
      </div>
    </div>
  );
}


function MappingView({
  tab, preview, mapping, defaults, autoMatched, onChange, onDefaultsChange, onBack, onImport, loading, error,
}: {
  tab: ImportTab;
  preview: CsvPreview;
  mapping: Record<string, string>;
  defaults: Record<string, string>;
  autoMatched: Set<string>;
  onChange: (m: Record<string, string>) => void;
  onDefaultsChange: (d: Record<string, string>) => void;
  onBack: () => void;
  onImport: () => void;
  loading: boolean;
  error: string | null;
}) {
  const fields           = FIELD_DEFS[tab];
  const required         = fields.filter((f) => f.required);
  const optional         = fields.filter((f) => !f.required);
  const unmappedRequired = required.filter((f) => !mapping[f.value] && !defaults[f.value]?.trim());
  const autoCount        = Object.keys(mapping).filter((k) => autoMatched.has(k) && mapping[k]).length;
  const manualCount      = Object.keys(mapping).filter((k) => !autoMatched.has(k) && mapping[k]).length;
  const canImport        = unmappedRequired.length === 0;

  const usedColumns      = new Set(Object.values(mapping).filter(Boolean));

  const row = (field: FieldDef) => {
    const selected   = mapping[field.value] ?? '';
    const fixedVal   = defaults[field.value] ?? '';
    const sampleVal  = selected ? preview.sample[selected] : '';
    const isSatisfied = selected || fixedVal.trim();
    const isAuto     = selected && autoMatched.has(field.value);

    return (
      <div key={field.value} className="grid grid-cols-2 gap-4 px-4 py-3 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-300 font-medium">{field.label}</span>
            {field.required
              ? <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border',
                  isSatisfied ? 'text-success bg-success/10 border-success/20' : 'text-danger bg-danger/10 border-danger/20')}>
                  {isSatisfied ? '✓ mapped' : 'Required'}
                </span>
              : <span className="text-[10px] text-slate-600">Optional</span>}
            {isAuto && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-600/15 text-brand-400 border border-brand-500/20">Auto</span>
            )}
          </div>
          {field.hint && <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">{field.hint}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <select
            value={selected}
            onChange={(e) => {
              onChange({ ...mapping, [field.value]: e.target.value });
              if (e.target.value) onDefaultsChange({ ...defaults, [field.value]: '' });
            }}
            className={cn(
              'w-full rounded-lg border bg-surface-200 px-2.5 py-1.5 text-sm outline-none transition-colors cursor-pointer',
              selected ? 'border-brand-500/30 text-fg' : 'border-surface-400/40 text-slate-500',
            )}
          >
            <option value="">— Not mapped —</option>
            {preview.headers.map((h) => {
              const alreadyUsed = usedColumns.has(h) && mapping[field.value] !== h;
              return (
                <option key={h} value={h}>
                  {h}{alreadyUsed ? ' (used)' : ''}
                </option>
              );
            })}
          </select>

          {sampleVal && (
            <p className="text-[11px] text-slate-600 truncate" title={sampleVal}>
              e.g. &ldquo;<span className="text-slate-400">{sampleVal}</span>&rdquo;
            </p>
          )}

          {!selected && (
            <SmartDefaultInput
              field={field}
              value={fixedVal}
              onChange={(v) => onDefaultsChange({ ...defaults, [field.value]: v })}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-brand-500/20 bg-brand-600/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-400 shrink-0" />
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-fg">{autoCount} column{autoCount !== 1 ? 's' : ''} auto-matched</span>
            {manualCount > 0 && <>, <span className="text-fg">{manualCount} manually mapped</span></>}
            {unmappedRequired.length > 0 && (
              <> · <span className="text-warning font-medium">{unmappedRequired.length} required field{unmappedRequired.length > 1 ? 's' : ''} need attention</span></>
            )}
          </p>
        </div>
        <button onClick={onBack} className="shrink-0 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← Change file
        </button>
      </div>

      {unmappedRequired.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
            Fix {unmappedRequired.length} required field{unmappedRequired.length > 1 ? 's' : ''} before importing
          </p>
          {unmappedRequired.map((field) => (
            <MissingFieldPrompt
              key={field.value}
              field={field}
              defaults={defaults}
              onDefaultsChange={onDefaultsChange}
            />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-surface-400/30 overflow-hidden">
        <div className="grid grid-cols-2 gap-4 border-b border-surface-400/20 bg-surface-200/60 px-4 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Valence field</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your CSV column / fixed default</p>
        </div>
        <div className="divide-y divide-surface-400/20 max-h-80 overflow-y-auto">
          {required.map(row)}
          {optional.length > 0 && (
            <div className="px-4 py-2 bg-surface-200/30">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Optional fields</p>
            </div>
          )}
          {optional.map(row)}
        </div>
      </div>

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
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
            : <><Upload className="h-4 w-4" /> Import {tab}</>}
        </button>
      </div>
    </div>
  );
}


type Phase = 'upload' | 'mapping' | 'done';

function CsvStep({
  tab,
  result,
  onResult,
}: {
  tab: ImportTab;
  result: ImportResult | null;
  onResult: (r: ImportResult) => void;
}) {
  const [phase,        setPhase]        = useState<Phase>(result ? 'done' : 'upload');
  const [file,         setFile]         = useState<File | null>(null);
  const [preview,      setPreview]      = useState<CsvPreview | null>(null);
  const [mapping,      setMapping]      = useState<Record<string, string>>({});
  const [autoMatched,  setAutoMatched]  = useState<Set<string>>(new Set());
  const [defaults,     setDefaults]     = useState<Record<string, string>>({});
  const [loading,      setLoading]      = useState(false);
  const [dragging,     setDragging]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    try {
      const prev = await parseCsvPreview(f);
      const suggested = autoSuggest(prev.headers, tab);
      setFile(f);
      setPreview(prev);
      setMapping(suggested);
      setAutoMatched(new Set(Object.keys(suggested)));
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

  if (phase === 'done' && result) {
    const planLimitErrors = result.errors.filter((e) => e.message.includes('upgrade your plan'));
    const dataErrors      = result.errors.filter((e) => !e.message.includes('upgrade your plan'));
    const hasUpdates      = (result.updated ?? 0) > 0;

    return (
      <div className="flex flex-col gap-4">
        <div className={cn('grid gap-3', hasUpdates ? 'grid-cols-4' : 'grid-cols-3')}>
          {[
            { label: 'Created',  value: result.created,        icon: CheckCircle, color: 'text-success' },
            ...(hasUpdates ? [{ label: 'Updated', value: result.updated ?? 0, icon: CheckCircle2, color: 'text-brand-400' }] : []),
            { label: 'Skipped',  value: result.skipped,        icon: AlertCircle, color: 'text-warning'  },
            { label: 'Errors',   value: dataErrors.length,     icon: XCircle,     color: 'text-danger'   },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-surface-400/30 bg-surface-100/50 py-4">
              <Icon className={cn('h-5 w-5', color)} />
              <p className="text-xl font-bold text-fg">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {planLimitErrors.length > 0 && (() => {
          const m = planLimitErrors[0].message.match(/Your (\w+) plan/);
          const planName = m?.[1] ?? 'current';
          return (
            <div className="flex items-center gap-3 rounded-xl border border-brand-500/20 bg-brand-600/10 px-4 py-3">
              <TrendingUp className="h-4 w-4 text-brand-400 shrink-0" />
              <p className="flex-1 text-sm min-w-0">
                <span className="font-semibold text-fg">{planLimitErrors.length.toLocaleString()} rows skipped</span>
                <span className="text-slate-400"> — {planName} plan · {result.currentCount}/{result.planLimit} used</span>
              </p>
              <a href="/settings?tab=billing" className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                Upgrade
              </a>
            </div>
          );
        })()}

        {dataErrors.length > 0 && (
          <div className="rounded-xl border border-surface-400/30 bg-surface-100/50 overflow-hidden">
            <div className="border-b border-surface-400/20 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Row errors</p>
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-surface-400/20">
              {dataErrors.map(({ row, message }) => (
                <div key={row} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="shrink-0 rounded bg-surface-300/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">Row {row}</span>
                  <span className="text-xs text-slate-400">{message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500">
          {result.created > 0 || (result.updated ?? 0) > 0
            ? [result.created > 0 && `${result.created} created`, (result.updated ?? 0) > 0 && `${result.updated} updated`].filter(Boolean).join(', ') + '.'
            : 'No records were imported.'}{' '}
          Continue to the next step or re-import to fix errors.
        </p>
      </div>
    );
  }

  if (phase === 'mapping' && preview) {
    return (
      <MappingView
        tab={tab}
        preview={preview}
        mapping={mapping}
        defaults={defaults}
        autoMatched={autoMatched}
        onChange={setMapping}
        onDefaultsChange={setDefaults}
        onBack={() => { setPhase('upload'); setFile(null); setPreview(null); setError(null); setDefaults({}); }}
        onImport={runImport}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-surface-400/30 bg-surface-100/50 p-4">
        <div>
          <p className="text-sm font-semibold text-fg mb-0.5">Download CSV template</p>
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
          <p className="text-sm font-medium text-slate-300">Drop a CSV, TXT, or Excel file here</p>
          <p className="text-xs text-slate-600">or click to browse — CSV · TSV · .xlsx; columns are detected automatically</p>
        </div>
        <input
          ref={inputRef} type="file" accept=".csv,.txt,.tsv,.xlsx,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <DocsPanel tab={tab} />
    </div>
  );
}


function DocumentsStep({ count, onCount }: { count: number; onCount: (n: number) => void }) {
  const [files,     setFiles]     = useState<File[]>([]);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded,  setUploaded]  = useState(count);
  const [errors,    setErrors]    = useState<string[]>([]);
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
      } catch { errs.push(f.name); }
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
        <p className="text-sm font-semibold text-fg mb-0.5">Upload lease documents</p>
        <p className="text-xs text-slate-500">
          PDFs, images, and Word documents. Associate files with properties and leases from the Documents page after uploading.
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
        <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
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
  const [phase, setPhase]         = useState<'computing' | 'ready'>('computing');
  const [doneCount, setDoneCount] = useState(0);
  const [summary, setSummary]     = useState<{ properties: number; leases: number; alerts: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (let i = 0; i < COMPUTE_ITEMS.length; i++) {
        await new Promise((r) => setTimeout(r, 600 + i * 400));
        if (cancelled) return;
        setDoneCount(i + 1);
      }
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
          <p className="text-lg font-semibold text-fg">Generating portfolio intelligence…</p>
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
              <span className={cn('text-sm transition-colors', i < doneCount ? 'text-slate-400' : i === doneCount ? 'text-fg' : 'text-slate-600')}>
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
        <p className="text-xl font-bold text-fg">Your portfolio is ready</p>
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
              <p className="text-2xl font-bold text-fg tabular-nums">{value}</p>
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


interface WizardState {
  properties: ImportResult | null;
  leases:     ImportResult | null;
  expenses:   ImportResult | null;
  documents:  number;
}

const STEP_DESCRIPTIONS: Record<StepId, string> = {
  properties:   'Import your property portfolio from a CSV file',
  leases:       'Import lease agreements and link them to properties',
  expenses:     'Import operating expenses and tag them by category',
  documents:    'Upload lease documents, insurance files, and permits',
  intelligence: 'Computing your portfolio health score and insights',
};

export default function ImportPage() {
  const hasSeen = localStorage.getItem(SPLASH_KEY) === '1';
  const [showWizard, setShowWizard] = useState(hasSeen);
  const [step,  setStep]  = useState(0);
  const [state, setState] = useState<WizardState>({ properties: null, leases: null, expenses: null, documents: 0 });

  if (!showWizard) {
    return <SplashScreen onStart={() => setShowWizard(true)} />;
  }

  const current    = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const canContinue = (() => {
    if (current.id === 'properties') return state.properties !== null;
    if (current.id === 'leases')     return state.leases !== null;
    if (current.id === 'expenses')   return state.expenses !== null;
    if (current.id === 'documents')  return true;
    return false;
  })();

  const stepLabel = current.id === 'intelligence' ? null : `Step ${step + 1} of ${STEPS.length - 1}`;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Import Wizard"
        description={stepLabel ?? 'Generating portfolio intelligence'}
        actions={
          <button
            onClick={() => { localStorage.removeItem(SPLASH_KEY); setShowWizard(false); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-400/30 bg-surface-200/60 hover:bg-surface-200 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" /> Import guide
          </button>
        }
      />

      <Card>
        <div className="flex items-center justify-between border-b border-surface-400/30 px-5 py-3">
          <Stepper current={step} />
        </div>

        <CardBody>
          {current.id !== 'intelligence' && (
            <div className="mb-6">
              <h2 className="text-base font-semibold text-fg">{current.label}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{STEP_DESCRIPTIONS[current.id]}</p>
            </div>
          )}

          {current.id === 'properties' && (
            <CsvStep tab="properties" result={state.properties} onResult={(r) => setState((s) => ({ ...s, properties: r }))} />
          )}
          {current.id === 'leases' && (
            <CsvStep tab="leases" result={state.leases} onResult={(r) => setState((s) => ({ ...s, leases: r }))} />
          )}
          {current.id === 'expenses' && (
            <CsvStep tab="expenses" result={state.expenses} onResult={(r) => setState((s) => ({ ...s, expenses: r }))} />
          )}
          {current.id === 'documents' && (
            <DocumentsStep count={state.documents} onCount={(n) => setState((s) => ({ ...s, documents: n }))} />
          )}
          {current.id === 'intelligence' && <IntelligenceStep />}
        </CardBody>

        {current.id !== 'intelligence' && (
          <div className="flex items-center justify-between border-t border-surface-400/30 px-5 py-4">
            {step > 0 ? (
              <button onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              {!canContinue && (
                <button onClick={() => setStep((s) => s + 1)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
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
