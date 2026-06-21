import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  propertiesService,
  type PropertyDetail,
  type CreatePropertyInput,
  type PropertyType,
  type PropertyStatus,
} from '@/services/properties.service';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'MIXED_USE', label: 'Mixed Use' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'OFFICE', label: 'Office' },
];

const PROPERTY_STATUSES: { value: PropertyStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'UNDER_RENOVATION', label: 'Under Renovation' },
  { value: 'DISPOSED', label: 'Disposed' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  property?: PropertyDetail;
  initialValues?: Partial<FormData>;
}

interface FormData {
  name: string;
  code: string;
  type: PropertyType;
  status: PropertyStatus;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  totalUnits: string;
  totalSqft: string;
  yearBuilt: string;
  purchasePrice: string;
  currentValue: string;
}

const emptyForm: FormData = {
  name: '', code: '', type: 'RESIDENTIAL', status: 'ACTIVE',
  address: '', city: '', state: '', zipCode: '',
  totalUnits: '', totalSqft: '', yearBuilt: '', purchasePrice: '', currentValue: '',
};

function toForm(p: PropertyDetail): FormData {
  return {
    name: p.name, code: p.code, type: p.type, status: p.status,
    address: p.address, city: p.city, state: p.state, zipCode: p.zipCode,
    totalUnits: String(p.totalUnits), totalSqft: String(p.totalSqft),
    yearBuilt: p.yearBuilt ? String(p.yearBuilt) : '',
    purchasePrice: p.purchasePrice ? String(p.purchasePrice) : '',
    currentValue: p.currentValue ? String(p.currentValue) : '',
  };
}

const LABEL_CLASS = 'text-xs font-medium text-slate-400 tracking-wide uppercase';
const SECTION_CLASS = 'mb-3 border-t border-surface-400/30 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500';

export default function PropertyFormModal({ open, onClose, property, initialValues }: Props) {
  const qc = useQueryClient();
  const isEdit = !!property;

  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(property ? toForm(property) : initialValues ? { ...emptyForm, ...initialValues } : emptyForm);
      setErrors({});
    }
  }, [open, property, initialValues]);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const val = (field === 'code' || field === 'state') ? e.target.value.toUpperCase() : e.target.value;
    setForm(f => ({ ...f, [field]: val }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  const setField = (field: keyof FormData) => (value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  const setMoney = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value.replace(/[^0-9.]/g, '') }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  const fmtMoney = (val: string) => {
    if (!val) return '';
    const [int, dec] = val.split('.');
    return dec !== undefined
      ? `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`
      : int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.code.trim() || form.code.trim().length < 2) errs.code = 'Min 2 characters';
    if (!form.address.trim()) errs.address = 'Required';
    if (!form.city.trim()) errs.city = 'Required';
    if (form.state.trim().length !== 2) errs.state = 'Must be 2 characters';
    if (!form.zipCode.trim()) errs.zipCode = 'Required';
    if (!form.totalUnits || Number(form.totalUnits) <= 0) errs.totalUnits = 'Must be positive';
    if (!form.totalSqft || Number(form.totalSqft) <= 0) errs.totalSqft = 'Must be positive';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayload = (): CreatePropertyInput => ({
    name: form.name.trim(),
    code: form.code.trim(),
    type: form.type,
    status: form.status,
    address: form.address.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    zipCode: form.zipCode.trim(),
    totalUnits: Number(form.totalUnits),
    totalSqft: Number(form.totalSqft),
    ...(form.yearBuilt && { yearBuilt: Number(form.yearBuilt) }),
    ...(form.purchasePrice && { purchasePrice: Number(form.purchasePrice) }),
    ...(form.currentValue && { currentValue: Number(form.currentValue) }),
  });

  const createMutation = useMutation({
    mutationFn: propertiesService.createProperty,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); qc.invalidateQueries({ queryKey: ['onboarding'] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (input: CreatePropertyInput) => propertiesService.updateProperty(property!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['properties', property!.id] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = buildPayload();
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const serverError = createMutation.error || updateMutation.error;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Property' : 'Add Property'} className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">

          {/* Basic Info */}
          <p className={SECTION_CLASS} style={{ borderTop: 'none', paddingTop: 0, marginBottom: 12 }}>Basic Info</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Property Name" value={form.name} onChange={set('name')} error={errors.name} placeholder="Oakwood Plaza" />
            <Input label="Code" value={form.code} onChange={set('code')} error={errors.code} placeholder="OAK01" disabled={isEdit} maxLength={20} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className={LABEL_CLASS}>Type</label>
              <Select size="md" value={form.type} onChange={setField('type')} options={PROPERTY_TYPES} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL_CLASS}>Status</label>
              <Select size="md" value={form.status} onChange={setField('status')} options={PROPERTY_STATUSES} />
            </div>
          </div>

          {/* Location */}
          <p className={SECTION_CLASS}>Location</p>
          <div className="mb-4">
            <Input label="Address" value={form.address} onChange={set('address')} error={errors.address} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Input label="City" value={form.city} onChange={set('city')} error={errors.city} placeholder="Toronto" />
            <Input label="Province" value={form.state} onChange={set('state')} error={errors.state} placeholder="ON" maxLength={2} />
            <Input label="Postal Code" value={form.zipCode} onChange={set('zipCode')} error={errors.zipCode} placeholder="M5V 3A8" />
          </div>

          {/* Building */}
          <p className={SECTION_CLASS}>Building</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Input label="Total Units" type="number" value={form.totalUnits} onChange={set('totalUnits')} error={errors.totalUnits} placeholder="24" min={1} />
            <Input label="Total Sq. Ft." type="number" value={form.totalSqft} onChange={set('totalSqft')} error={errors.totalSqft} placeholder="48000" min={1} />
            <Input label="Year Built" type="number" value={form.yearBuilt} onChange={set('yearBuilt')} placeholder="1995" min={1800} max={new Date().getFullYear()} />
          </div>

          {/* Financials */}
          <p className={SECTION_CLASS}>Financials <span className="normal-case font-normal text-slate-600">(optional)</span></p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Purchase Price"
              value={fmtMoney(form.purchasePrice)}
              onChange={setMoney('purchasePrice')}
              placeholder="72,000,000"
              prefix={<DollarSign className="h-3.5 w-3.5" />}
            />
            <Input
              label="Current Value"
              value={fmtMoney(form.currentValue)}
              onChange={setMoney('currentValue')}
              placeholder="94,000,000"
              prefix={<DollarSign className="h-3.5 w-3.5" />}
            />
          </div>
        </div>

        {serverError && (
          <p className="mx-5 mb-3 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">
            {(serverError as { message?: string }).message ?? 'Something went wrong'}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-surface-400/40 px-5 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" size="sm" loading={isPending}>
            {isEdit ? 'Save Changes' : 'Add Property'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
