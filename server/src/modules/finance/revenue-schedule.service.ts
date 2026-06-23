import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';

const REVENUE_REF_PREFIX = 'lease-rent';
const MAX_MONTHS = 600;

type DbClient = Prisma.TransactionClient | typeof prisma;

export type RevenueLease = {
  id: string;
  propertyId: string;
  baseRent: Prisma.Decimal | number;
  rentEscalation: Prisma.Decimal | number;
  startDate: Date;
  endDate: Date;
};

export function buildRevenueSchedule(lease: RevenueLease, now: Date = new Date()): Prisma.FinancialRecordCreateManyInput[] {
  const baseRent = Number(lease.baseRent);
  const escalation = Number(lease.rentEscalation);
  if (!baseRent || baseRent <= 0) return [];

  // Month math runs in UTC so calendar periods are independent of server timezone —
  // imported leases store dates at UTC midnight, which local-time math would shift across boundaries.
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const endMonth = lease.endDate.getUTCFullYear() * 12 + lease.endDate.getUTCMonth();

  let year = lease.startDate.getUTCFullYear();
  let month = lease.startDate.getUTCMonth();

  const records: Prisma.FinancialRecordCreateManyInput[] = [];

  for (let monthIndex = 0; year * 12 + month <= endMonth && monthIndex < MAX_MONTHS; monthIndex++) {
    const periodStart = new Date(Date.UTC(year, month, 1));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    const escalationYear = Math.floor(monthIndex / 12);
    const amount = Math.round(baseRent * Math.pow(1 + escalation, escalationYear) * 100) / 100;
    const collected = year * 12 + month < currentMonth;

    records.push({
      propertyId: lease.propertyId,
      leaseId: lease.id,
      type: 'REVENUE',
      status: collected ? 'RECONCILED' : 'PENDING',
      amount,
      periodStart,
      periodEnd,
      dueDate: periodStart,
      paidDate: collected ? periodStart : null,
      description: 'Monthly rent',
      category: 'RENT',
      referenceId: `${REVENUE_REF_PREFIX}:${lease.id}:${year}-${String(month + 1).padStart(2, '0')}`,
      metadata: { generated: true, source: 'lease-schedule' },
    });

    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }

  return records;
}

export async function syncLeaseRevenueSchedule(lease: RevenueLease, client: DbClient = prisma): Promise<number> {
  await client.financialRecord.deleteMany({
    where: { leaseId: lease.id, referenceId: { startsWith: `${REVENUE_REF_PREFIX}:` } },
  });
  const data = buildRevenueSchedule(lease);
  if (data.length) await client.financialRecord.createMany({ data });
  return data.length;
}

export async function backfillRevenueSchedules(): Promise<{ leasesProcessed: number; recordsCreated: number }> {
  const leases = await prisma.lease.findMany({
    select: { id: true, propertyId: true, baseRent: true, rentEscalation: true, startDate: true, endDate: true },
  });

  let recordsCreated = 0;
  for (const lease of leases) {
    recordsCreated += await syncLeaseRevenueSchedule(lease);
  }

  return { leasesProcessed: leases.length, recordsCreated };
}
