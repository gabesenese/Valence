import type { FinancialRecord, Property, Lease, Tenant } from '@prisma/client';

export type ActivityActionType = 'REVIEW' | 'COLLECT' | 'RECONCILE' | null;

export type EventKind = 'REFERENCE' | 'TASK';

export interface FinancialActivityEvent {
  id: string;
  date: string;
  type: FinancialRecord['type'];
  category: string | null;
  description: string | null;
  amount: number;
  status: FinancialRecord['status'];
  source: string | null;
  property: { id: string; name: string; code: string };
  tenant: { id: string; name: string } | null;
  kind: EventKind;
  isActionable: boolean;
  actionType: ActivityActionType;
  relatedLeaseId: string | null;
  relatedInvoiceId: string | null;
}

export type ActivityRecord = FinancialRecord & {
  property: Pick<Property, 'id' | 'name' | 'code'>;
  lease: ({ tenant: Pick<Tenant, 'id' | 'name'> } & Pick<Lease, 'id'>) | null;
};

function resolveAction(record: FinancialRecord, now: Date): ActivityActionType {
  if (record.status === 'FLAGGED' || record.status === 'DISPUTED') return 'REVIEW';
  const overdue = record.type === 'REVENUE' && record.dueDate != null && record.dueDate.getTime() < now.getTime();
  if (overdue && record.status !== 'RECONCILED') return 'COLLECT';
  if (record.status === 'PENDING') return 'RECONCILE';
  return null;
}

export function toActivityEvent(record: ActivityRecord, now: Date = new Date()): FinancialActivityEvent {
  const source = (record.metadata as { source?: string } | null)?.source ?? null;
  const actionType = resolveAction(record, now);
  const kind: EventKind = actionType === 'REVIEW' || actionType === 'COLLECT' ? 'TASK' : 'REFERENCE';

  return {
    id: record.id,
    date: (record.paidDate ?? record.periodStart).toISOString(),
    type: record.type,
    category: record.category ?? null,
    description: record.description ?? null,
    amount: Number(record.amount),
    status: record.status,
    source,
    property: record.property,
    tenant: record.lease?.tenant ?? null,
    kind,
    isActionable: actionType !== null,
    actionType,
    relatedLeaseId: record.leaseId ?? null,
    relatedInvoiceId: record.referenceId ?? null,
  };
}

const ACTION_RANK: Record<Exclude<ActivityActionType, null>, number> = {
  REVIEW: 0,
  COLLECT: 1,
  RECONCILE: 2,
};

export function rankPulse(a: FinancialActivityEvent, b: FinancialActivityEvent): number {
  if (a.isActionable !== b.isActionable) return a.isActionable ? -1 : 1;
  if (a.actionType && b.actionType && a.actionType !== b.actionType) {
    return ACTION_RANK[a.actionType] - ACTION_RANK[b.actionType];
  }
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}
