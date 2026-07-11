import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { crmService } from '@/services/crm.service';

export type TenantEmailType =
  | 'RENEWAL_REMINDER'
  | 'RENT_INCREASE'
  | 'PAYMENT_REMINDER'
  | 'DOCUMENT_REQUEST'
  | 'MAINTENANCE_FOLLOWUP'
  | 'CUSTOM';

const EMAIL_TYPES: Array<{ value: TenantEmailType; label: string }> = [
  { value: 'RENEWAL_REMINDER',   label: 'Renewal reminder' },
  { value: 'RENT_INCREASE',      label: 'Rent-increase notice' },
  { value: 'PAYMENT_REMINDER',   label: 'Payment reminder' },
  { value: 'DOCUMENT_REQUEST',   label: 'Document request' },
  { value: 'MAINTENANCE_FOLLOWUP', label: 'Maintenance follow-up' },
  { value: 'CUSTOM',             label: 'Custom message' },
];

interface LeaseContext {
  id: string;
  propertyName: string;
  unitNumber?: string | null;
  baseRent: number;
  endDate: string;
}

function buildTemplate(
  type: TenantEmailType,
  tenantName: string,
  lease?: LeaseContext,
): { subject: string; body: string } {
  const property = lease
    ? `${lease.propertyName}${lease.unitNumber ? ` (Unit ${lease.unitNumber})` : ''}`
    : 'your unit';
  const rent = lease ? `$${Number(lease.baseRent).toLocaleString()}` : '';
  const endDate = lease
    ? new Date(lease.endDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  switch (type) {
    case 'RENEWAL_REMINDER':
      return {
        subject: `Your lease at ${property} is coming up for renewal`,
        body: `Hi ${tenantName},\n\nI wanted to reach out as your lease at ${property} is approaching its renewal date${endDate ? ` on ${endDate}` : ''}.\n\nWe'd love to have you stay and would like to discuss your renewal options. Please let me know a good time to connect.\n\nLooking forward to hearing from you.`,
      };
    case 'RENT_INCREASE':
      return {
        subject: `Notice of rent adjustment — ${property}`,
        body: `Hi ${tenantName},\n\nPlease be advised that effective on your next lease term, the monthly rent for ${property} will be adjusted to ${rent}.\n\nThis notice is provided in accordance with your lease agreement. If you have any questions, please don't hesitate to reach out.`,
      };
    case 'PAYMENT_REMINDER':
      return {
        subject: `Friendly reminder: rent due for ${property}`,
        body: `Hi ${tenantName},\n\nThis is a friendly reminder that your rent payment of ${rent} is due for ${property}.\n\nIf you've already sent your payment, please disregard this message. If you have any questions about your balance, feel free to reach out.`,
      };
    case 'DOCUMENT_REQUEST':
      return {
        subject: `Document request — ${property}`,
        body: `Hi ${tenantName},\n\nI'm reaching out because we are missing a required document for your file at ${property}.\n\nCould you please send over the updated document at your earliest convenience? Let me know if you have any questions.`,
      };
    case 'MAINTENANCE_FOLLOWUP':
      return {
        subject: `Following up on your maintenance request — ${property}`,
        body: `Hi ${tenantName},\n\nI'm following up on the recent maintenance request for ${property}.\n\nI wanted to make sure everything was resolved to your satisfaction. Please let me know if there are any outstanding concerns.`,
      };
    default:
      return { subject: '', body: `Hi ${tenantName},\n\n` };
  }
}

interface Props {
  tenantId: string;
  tenantName: string;
  tenantEmail: string | null | undefined;
  lease?: LeaseContext;
  onClose: () => void;
}

export function EmailTenantModal({ tenantId, tenantName, tenantEmail, lease, onClose }: Props) {
  const [type, setType] = useState<TenantEmailType>('RENEWAL_REMINDER');
  const [subject, setSubject] = useState(() => buildTemplate('RENEWAL_REMINDER', tenantName, lease).subject);
  const [body, setBody] = useState(() => buildTemplate('RENEWAL_REMINDER', tenantName, lease).body);
  const qc = useQueryClient();

  function handleTypeChange(t: TenantEmailType) {
    setType(t);
    const tpl = buildTemplate(t, tenantName, lease);
    setSubject(tpl.subject);
    setBody(tpl.body);
  }

  const mutation = useMutation({
    mutationFn: () =>
      crmService.emailTenant(tenantId, {
        subject,
        body,
        leaseId: lease?.id,
        fromLabel: 'Your Property Manager',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts', tenantId] });
      qc.invalidateQueries({ queryKey: ['crm', 'tenant', tenantId] });
      onClose();
    },
  });

  const inputCls = 'w-full rounded-lg border border-surface-400/40 bg-surface-200 px-3 text-sm text-slate-200 placeholder-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/10';

  return (
    <Modal open title="Email tenant" onClose={onClose}>
      <div className="space-y-4">
        {!tenantEmail && (
          <p className="rounded-lg bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning">
            No email address on file for this tenant.
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{tenantEmail ?? '—'}</span>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Template</label>
          <div className="flex flex-wrap gap-1.5">
            {EMAIL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors border ${
                  type === t.value
                    ? 'bg-brand-600/30 text-brand-300 border-brand-600/40'
                    : 'text-slate-500 border-transparent hover:border-surface-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={`${inputCls} h-9 py-0`}
            placeholder="Email subject…"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className={`${inputCls} py-2.5 resize-none`}
            placeholder="Message body…"
          />
          <p className="mt-1 text-[10px] text-slate-600">A CASL-compliant unsubscribe notice is appended automatically.</p>
        </div>

        {mutation.isError && (
          <p className="text-xs text-danger">{(mutation.error as Error).message}</p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!tenantEmail || !subject.trim() || !body.trim()}
        >
          Send email
        </Button>
      </div>
    </Modal>
  );
}
