import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  tenantsService,
  type Tenant,
  type CreateTenantInput,
  type CreditScoreSource,
} from '@/services/tenants.service';

const CREDIT_SOURCE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual entry' },
  { value: 'EQUIFAX', label: 'Equifax' },
  { value: 'TRANSUNION', label: 'TransUnion' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  tenant?: Tenant;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  taxId: string;
  creditScore: string;
  creditScoreSource: string;
  creditScoreDate: string;
  notes: string;
  isActive: boolean;
}

const emptyForm: FormData = {
  name: '', email: '', phone: '', company: '',
  taxId: '', creditScore: '', creditScoreSource: 'MANUAL', creditScoreDate: '',
  notes: '', isActive: true,
};

function toForm(t: Tenant): FormData {
  return {
    name: t.name,
    email: t.email ?? '',
    phone: (t as { phone?: string }).phone ?? '',
    company: t.company ?? '',
    taxId: (t as { taxId?: string }).taxId ?? '',
    creditScore: t.creditScore ? String(t.creditScore) : '',
    creditScoreSource: t.creditScoreSource ?? 'MANUAL',
    creditScoreDate: t.creditScoreDate ? t.creditScoreDate.slice(0, 10) : '',
    notes: (t as { notes?: string }).notes ?? '',
    isActive: t.isActive,
  };
}

const SECTION_CLASS = 'mb-3 border-t border-surface-400/30 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500';

export default function TenantFormModal({ open, onClose, tenant }: Props) {
  const qc = useQueryClient();
  const isEdit = !!tenant;

  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(tenant ? toForm(tenant) : emptyForm);
      setErrors({});
    }
  }, [open, tenant]);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  const setField = (field: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (form.creditScore && (Number(form.creditScore) < 300 || Number(form.creditScore) > 850))
      errs.creditScore = 'Must be between 300 and 850';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayload = (): CreateTenantInput => ({
    name: form.name.trim(),
    ...(form.email && { email: form.email.trim() }),
    ...(form.phone && { phone: form.phone.trim() }),
    ...(form.company && { company: form.company.trim() }),
    ...(form.taxId && { taxId: form.taxId.trim() }),
    ...(form.creditScore && { creditScore: Number(form.creditScore) }),
    ...(form.creditScore && form.creditScoreSource && {
      creditScoreSource: form.creditScoreSource as CreditScoreSource,
    }),
    ...(form.creditScore && form.creditScoreDate && {
      creditScoreDate: new Date(form.creditScoreDate).toISOString(),
    }),
    ...(form.notes && { notes: form.notes.trim() }),
    isActive: form.isActive,
  });

  const createMutation = useMutation({
    mutationFn: tenantsService.createTenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (input: Partial<CreateTenantInput>) => tenantsService.updateTenant(tenant!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Tenant' : 'Add Tenant'}>
      <form onSubmit={handleSubmit}>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">

          {/* Identity */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Identity</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <Input label="Full Name / Business Name *" value={form.name} onChange={set('name')} error={errors.name} placeholder="Acme Corp or Jane Smith" />
            </div>
            <Input label="Company" value={form.company} onChange={set('company')} placeholder="Parent company (if any)" />
            <Input label="Tax ID / EIN" value={form.taxId} onChange={set('taxId')} placeholder="12-3456789" />
          </div>

          {/* Contact */}
          <p className={SECTION_CLASS}>Contact</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="contact@acme.com" />
            <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
          </div>

          {/* Financial */}
          <p className={SECTION_CLASS}>Financial</p>
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Credit Score"
                type="number"
                value={form.creditScore}
                onChange={set('creditScore')}
                error={errors.creditScore}
                placeholder="700"
                min={300}
                max={850}
              />
              <Input
                label="As of"
                type="date"
                value={form.creditScoreDate}
                onChange={set('creditScoreDate')}
                disabled={!form.creditScore}
              />
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Source</label>
              <Select
                value={form.creditScoreSource}
                onChange={(v) => setField('creditScoreSource', v)}
                options={CREDIT_SOURCE_OPTIONS}
                size="md"
                disabled={!form.creditScore}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              300–850 range. Enter the score your business has gathered for this tenant — Valence stores it
              for your records and doesn't run credit checks. Source is optional and just notes where it came from.
            </p>
          </div>

          {/* Notes */}
          <p className={SECTION_CLASS}>Notes <span className="normal-case font-normal text-slate-600">(optional)</span></p>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={3}
            placeholder="Any relevant background, history, or special conditions…"
            className="w-full rounded-lg border border-surface-400 bg-surface-200 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30 resize-none"
          />

          {isEdit && (
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-surface-400 bg-surface-200 accent-brand-500"
              />
              <label htmlFor="isActive" className="text-sm text-slate-300">Active tenant</label>
            </div>
          )}
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
            {isEdit ? 'Save Changes' : 'Add Tenant'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
