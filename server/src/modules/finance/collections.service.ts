import { prisma } from '../../infrastructure/database';
import { NotFoundError } from '../../utils/errors';

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type CollectionAction = 'REMIND' | 'APPLY_FEE' | 'ESCALATE' | 'RECORD';
export type RecoveryBand = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CollectionsContext {
  leaseId: string;
  tenantName: string;
  propertyName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  monthlyRent: number;
  outstandingBalance: number;
  daysOverdue: number;
  lateFeeConfigured: boolean;
  lastReminderAt: string | null;
  recommendation: { action: CollectionAction; reason: string };
  recovery: { band: RecoveryBand; reasons: string[] };
  history: { date: string; label: string }[];
  overdueRecordIds: string[];
}

async function loadLease(userId: string, leaseId: string) {
  return prisma.lease.findFirst({
    where: { id: leaseId, deletedAt: null, property: { ownerId: userId, deletedAt: null } },
    select: {
      id: true,
      baseRent: true,
      lateFeeType: true,
      lateFeeFlat: true,
      lateFeePercent: true,
      lastContactedAt: true,
      propertyId: true,
      property: { select: { name: true } },
      tenant: { select: { name: true, email: true, phone: true } },
      financialRecords: {
        where: { type: 'REVENUE', status: { not: 'VOID' } },
        select: { id: true, status: true, amount: true, dueDate: true, paidDate: true },
        orderBy: { periodStart: 'desc' },
        take: 24,
      },
    },
  });
}

export async function getCollectionsContext(userId: string, leaseId: string): Promise<CollectionsContext> {
  const lease = await loadLease(userId, leaseId);
  if (!lease) throw new NotFoundError('Lease');

  const now = new Date();
  const overdue = lease.financialRecords.filter((r) => r.status === 'PENDING' && r.dueDate != null && r.dueDate < now);
  const outstandingBalance = round2(overdue.reduce((s, r) => s + Number(r.amount), 0));
  const daysOverdue = overdue.reduce((m, r) => (r.dueDate ? Math.max(m, Math.floor((now.getTime() - r.dueDate.getTime()) / DAY)) : m), 0);
  const overdueRecordIds = overdue.map((r) => r.id);
  const lateFeeConfigured = lease.lateFeeType !== 'NONE';
  const lastReminderAt = lease.lastContactedAt;
  const daysSinceReminder = lastReminderAt ? Math.floor((now.getTime() - lastReminderAt.getTime()) / DAY) : null;

  const past = lease.financialRecords.filter((r) => r.dueDate != null && r.dueDate < now);
  const onTime = past.filter((r) => r.status === 'RECONCILED').length;
  const total = past.length;

  const reasons: string[] = [];
  let score = 0;
  if (total > 0) {
    if (onTime / total >= 0.9) { reasons.push(`Paid on time ${onTime} of last ${total} ${plural(total, 'month')}`); score += 2; }
    else { reasons.push(`Paid on time ${onTime} of last ${total} ${plural(total, 'month')}`); score -= 1; }
  }
  if (daysOverdue <= 15) { reasons.push(`Only ${daysOverdue} ${plural(daysOverdue, 'day')} overdue`); score += 1; }
  else if (daysOverdue >= 45) { reasons.push(`${daysOverdue} days overdue`); score -= 2; }
  else { reasons.push(`${daysOverdue} days overdue`); }
  if (daysSinceReminder === null) { reasons.push('No reminder sent yet'); score += 1; }
  else if (daysSinceReminder > 14) { reasons.push(`${daysSinceReminder} days since last reminder`); score -= 1; }
  else { reasons.push('Reminder recently sent'); }

  const band: RecoveryBand = score >= 2 ? 'HIGH' : score <= -1 ? 'LOW' : 'MEDIUM';

  let recommendation: { action: CollectionAction; reason: string };
  if (daysSinceReminder === null || daysSinceReminder >= 14) {
    recommendation = {
      action: 'REMIND',
      reason: lastReminderAt
        ? `Last reminder was ${daysSinceReminder} days ago. Send another before escalating.`
        : 'Tenant has not been reminded yet. Send a payment reminder before escalating.',
    };
  } else if (daysOverdue > 30) {
    recommendation = { action: 'ESCALATE', reason: 'More than 30 days overdue with a reminder already sent. Consider escalation.' };
  } else if (lateFeeConfigured) {
    recommendation = { action: 'APPLY_FEE', reason: 'Reminder already sent. Apply the late fee.' };
  } else {
    recommendation = { action: 'RECORD', reason: 'Reminder sent recently. Record the payment once it arrives.' };
  }

  const history: { date: string; label: string }[] = [];
  const oldest = overdue.reduce<typeof overdue[number] | null>((m, r) => (!m || (r.dueDate! < m.dueDate!) ? r : m), null);
  if (oldest?.dueDate) history.push({ date: oldest.dueDate.toISOString(), label: 'Rent due' });
  if (lastReminderAt) history.push({ date: lastReminderAt.toISOString(), label: 'Reminder sent' });
  history.push({ date: now.toISOString(), label: 'Awaiting payment' });

  return {
    leaseId: lease.id,
    tenantName: lease.tenant.name,
    propertyName: lease.property.name,
    contactEmail: lease.tenant.email ?? null,
    contactPhone: lease.tenant.phone ?? null,
    monthlyRent: Number(lease.baseRent),
    outstandingBalance,
    daysOverdue,
    lateFeeConfigured,
    lastReminderAt: lastReminderAt?.toISOString() ?? null,
    recommendation,
    recovery: { band, reasons },
    history,
    overdueRecordIds,
  };
}

export async function recordPayment(userId: string, leaseId: string): Promise<{ recorded: number }> {
  const lease = await prisma.lease.findFirst({ where: { id: leaseId, deletedAt: null, property: { ownerId: userId, deletedAt: null } }, select: { id: true } });
  if (!lease) throw new NotFoundError('Lease');
  const now = new Date();
  const res = await prisma.financialRecord.updateMany({
    where: { leaseId, type: 'REVENUE', status: 'PENDING', dueDate: { lt: now } },
    data: { status: 'RECONCILED', paidDate: now },
  });
  return { recorded: res.count };
}

export async function sendReminder(userId: string, leaseId: string): Promise<{ sent: boolean }> {
  const lease = await prisma.lease.findFirst({ where: { id: leaseId, deletedAt: null, property: { ownerId: userId, deletedAt: null } }, select: { id: true } });
  if (!lease) throw new NotFoundError('Lease');
  await prisma.lease.update({ where: { id: leaseId }, data: { lastContactedAt: new Date() } });
  return { sent: true };
}

export async function applyLateFee(userId: string, leaseId: string): Promise<{ applied: number }> {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, deletedAt: null, property: { ownerId: userId, deletedAt: null } },
    select: {
      id: true, propertyId: true, lateFeeType: true, lateFeeFlat: true, lateFeePercent: true,
      financialRecords: { where: { type: 'REVENUE', status: 'PENDING' }, select: { amount: true, dueDate: true } },
    },
  });
  if (!lease) throw new NotFoundError('Lease');
  if (lease.lateFeeType === 'NONE') return { applied: 0 };

  const now = new Date();
  const overdueBalance = lease.financialRecords
    .filter((r) => r.dueDate != null && r.dueDate < now)
    .reduce((s, r) => s + Number(r.amount), 0);
  const fee = lease.lateFeeType === 'FLAT'
    ? Number(lease.lateFeeFlat ?? 0)
    : round2((Number(lease.lateFeePercent ?? 0) / 100) * overdueBalance);
  if (fee <= 0) return { applied: 0 };

  await prisma.financialRecord.create({
    data: {
      propertyId: lease.propertyId,
      leaseId,
      type: 'REVENUE',
      status: 'PENDING',
      amount: fee,
      periodStart: now,
      periodEnd: now,
      dueDate: now,
      category: 'LATE_FEE',
      description: 'Late fee',
    },
  });
  return { applied: round2(fee) };
}

function plural(n: number, one: string): string {
  return n === 1 ? one : `${one}s`;
}
