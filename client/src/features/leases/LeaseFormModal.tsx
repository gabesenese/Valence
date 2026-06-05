import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { leasesService, type Lease, type CreateLeaseInput } from '@/services/leases.service';
import { propertiesService } from '@/services/properties.service';
import { tenantsService } from '@/services/tenants.service';

const LEASE_TYPES = [
  { value: 'GROSS', label: 'Gross — landlord pays operating expenses' },
  { value: 'NET', label: 'Net — tenant pays property expenses' },
  { value: 'MODIFIED_GROSS', label: 'Modified Gross — expenses split' },
  { value: 'PERCENTAGE', label: 'Percentage — base rent + % of revenue' },
  { value: 'GROUND', label: 'Ground Lease — land only' },
];

const LEASE_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending — not yet started' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RENEWED', label: 'Renewed' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  lease?: Lease;
}

interface FormData {
  propertyId: string;
  tenantId: string;
  unitNumber: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  baseRent: string;
  rentEscalation: string;
  securityDeposit: string;
  sqft: string;
  notes: string;
}

const emptyForm: FormData = {
  propertyId: '', tenantId: '', unitNumber: '',
  type: 'GROSS', status: 'ACTIVE',
  startDate: '', endDate: '',
  baseRent: '', rentEscalation: '0',
  securityDeposit: '', sqft: '', notes: '',
};

function toForm(l: Lease): FormData {
  return {
    propertyId: l.propertyId,
    tenantId: l.tenantId,
    unitNumber: l.unitNumber ?? '',
    type: l.type,
    status: l.status,
    startDate: l.startDate.slice(0, 10),
    endDate: l.endDate.slice(0, 10),
    baseRent: String(l.baseRent),
    rentEscalation: String(parseFloat((Number(l.rentEscalation) * 100).toFixed(10))),
    securityDeposit: l.securityDeposit ? String(l.securityDeposit) : '',
    sqft: l.sqft ? String(l.sqft) : '',
    notes: l.notes ?? '',
  };
}

const SELECT_CLASS = 'h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30 disabled:opacity-50';
const LABEL_CLASS = 'text-xs font-medium text-slate-400 tracking-wide uppercase';
const SECTION_CLASS = 'mb-3 border-t border-surface-400/30 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500';

export default function LeaseFormModal({ open, onClose, lease }: Props) {
  const qc = useQueryClient();
  const isEdit = !!lease;

  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const { data: properties } = useQuery({
    queryKey: ['properties', { limit: 50 }],
    queryFn: () => propertiesService.getProperties({ limit: 50, status: 'ACTIVE' }),
    enabled: open,
  });

  const { data: tenants } = useQuery({
    queryKey: ['tenants', { limit: 100 }],
    queryFn: () => tenantsService.getTenants({ limit: 100 }),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm(lease ? toForm(lease) : emptyForm);
      setErrors({});
    }
  }, [open, lease]);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  const setMoney = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setForm(f => ({ ...f, [field]: raw }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  const fmtMoney = (val: string) => {
    if (!val) return '';
    const [int, dec] = val.split('.');
    const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return dec !== undefined ? `${formatted}.${dec}` : formatted;
  };

  const setDate = (field: 'startDate' | 'endDate') => (val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!isEdit && !form.propertyId) errs.propertyId = 'Required';
    if (!isEdit && !form.tenantId) errs.tenantId = 'Required';
    if (!form.startDate) errs.startDate = 'Required';
    if (!form.endDate) errs.endDate = 'Required';
    if (form.startDate && form.endDate && form.endDate <= form.startDate)
      errs.endDate = 'Must be after start date';
    if (!form.baseRent || Number(form.baseRent) <= 0) errs.baseRent = 'Must be a positive amount';
    if (form.rentEscalation !== '' && (Number(form.rentEscalation) < 0 || Number(form.rentEscalation) > 100))
      errs.rentEscalation = 'Must be between 0 and 100';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toDatetime = (d: string) => `${d}T00:00:00.000Z`;

  const buildPayload = () => ({
    ...(!isEdit && { propertyId: form.propertyId, tenantId: form.tenantId }),
    unitNumber: form.unitNumber || undefined,
    type: form.type,
    ...(isEdit && { status: form.status }),
    startDate: toDatetime(form.startDate),
    endDate: toDatetime(form.endDate),
    baseRent: Number(form.baseRent),
    rentEscalation: Number(form.rentEscalation) / 100,
    // In edit mode send null to clear; in create mode omit if empty
    ...(isEdit
      ? {
          securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : null,
          sqft:            form.sqft            ? Number(form.sqft)            : null,
          notes:           form.notes           || null,
        }
      : {
          ...(form.securityDeposit && { securityDeposit: Number(form.securityDeposit) }),
          ...(form.sqft            && { sqft:            Number(form.sqft) }),
          ...(form.notes           && { notes:           form.notes }),
        }),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateLeaseInput) => leasesService.createLease(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: ReturnType<typeof buildPayload>) => leasesService.updateLease(lease!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] });
      qc.invalidateQueries({ queryKey: ['leases', lease!.id] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = buildPayload();
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload as CreateLeaseInput);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const serverError = createMutation.error || updateMutation.error;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Lease' : 'Add New Lease'} className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">

          {/* Parties — only shown on create */}
          {!isEdit && (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Parties</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL_CLASS}>Property <span className="text-danger">*</span></label>
                  <select value={form.propertyId} onChange={set('propertyId')} className={`${SELECT_CLASS} ${errors.propertyId ? 'border-danger/60' : ''}`}>
                    <option value="">Select property…</option>
                    {properties?.data.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                  {errors.propertyId && <p className="text-xs text-danger">{errors.propertyId}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL_CLASS}>Tenant <span className="text-danger">*</span></label>
                  <select value={form.tenantId} onChange={set('tenantId')} className={`${SELECT_CLASS} ${errors.tenantId ? 'border-danger/60' : ''}`}>
                    <option value="">Select tenant…</option>
                    {tenants?.data.map(t => (
                      <option key={t.id} value={t.id}>{t.name}{t.company ? ` (${t.company})` : ''}</option>
                    ))}
                  </select>
                  {errors.tenantId && <p className="text-xs text-danger">{errors.tenantId}</p>}
                </div>
              </div>
            </>
          )}

          {/* Lease Details */}
          <p className={isEdit ? 'mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500' : SECTION_CLASS}>
            Lease Details
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className={LABEL_CLASS}>Lease Type</label>
              <select value={form.type} onChange={set('type')} className={SELECT_CLASS}>
                {LEASE_TYPES.map(t => <option key={t.value} value={t.value}>{t.value.replace('_', ' ')}</option>)}
              </select>
              <p className="text-xs text-slate-600">
                {LEASE_TYPES.find(t => t.value === form.type)?.label.split('—')[1]?.trim()}
              </p>
            </div>
            {isEdit && (
              <div className="flex flex-col gap-1.5">
                <label className={LABEL_CLASS}>Status</label>
                <select value={form.status} onChange={set('status')} className={SELECT_CLASS}>
                  {LEASE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
            <Input
              label="Unit / Suite Number"
              value={form.unitNumber}
              onChange={set('unitNumber')}
              placeholder="e.g. 4B, Suite 201"
            />
          </div>

          {/* Term */}
          <p className={SECTION_CLASS}>Term</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className={LABEL_CLASS}>Start Date <span className="text-danger">*</span></label>
              <DatePicker value={form.startDate} onChange={setDate('startDate')} placeholder="Select start date" />
              {errors.startDate && <p className="text-xs text-danger">{errors.startDate}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL_CLASS}>End Date <span className="text-danger">*</span></label>
              <DatePicker value={form.endDate} onChange={setDate('endDate')} placeholder="Select end date" />
              {errors.endDate && <p className="text-xs text-danger">{errors.endDate}</p>}
            </div>
          </div>

          {/* Financials */}
          <p className={SECTION_CLASS}>Financials</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input
              label="Monthly Base Rent *"
              value={fmtMoney(form.baseRent)}
              onChange={setMoney('baseRent')}
              error={errors.baseRent}
              placeholder="5,000"
              prefix={<DollarSign className="h-3.5 w-3.5" />}
            />
            <div className="flex flex-col gap-1.5">
              <label className={LABEL_CLASS}>Annual Rent Escalation %</label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  value={form.rentEscalation}
                  onChange={set('rentEscalation')}
                  placeholder="3"
                  min={0}
                  max={100}
                  step={0.1}
                  className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 pr-8 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                />
                <span className="absolute right-3 text-xs text-slate-500">%</span>
              </div>
              {errors.rentEscalation && <p className="text-xs text-danger">{errors.rentEscalation}</p>}
            </div>
            <Input
              label="Security Deposit"
              value={fmtMoney(form.securityDeposit)}
              onChange={setMoney('securityDeposit')}
              placeholder="10,000"
              prefix={<DollarSign className="h-3.5 w-3.5" />}
            />
            <Input
              label="Leased Sq. Ft."
              type="number"
              value={form.sqft}
              onChange={set('sqft')}
              placeholder="2400"
              min={0}
            />
          </div>

          {/* Notes */}
          <p className={SECTION_CLASS}>Notes <span className="normal-case font-normal text-slate-600">(optional)</span></p>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={3}
            placeholder="Special terms, conditions, or anything worth noting…"
            className="w-full rounded-lg border border-surface-400 bg-surface-200 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30 resize-none"
          />
        </div>

        {serverError && (
          <p className="mx-5 mb-3 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">
            {(serverError as { response?: { data?: { message?: string } }; message?: string })
              .response?.data?.message ?? (serverError as { message?: string }).message ?? 'Something went wrong'}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-surface-400/40 px-5 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" size="sm" loading={isPending}>
            {isEdit ? 'Save Changes' : 'Create Lease'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
