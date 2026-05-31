import { Prisma, RenewalRisk } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError } from '../../utils/errors';
import type { CreateLeaseInput, UpdateLeaseInput, LeaseQuery } from './leases.schemas';
import { addDays, differenceInDays, parseISO } from 'date-fns';

export function computeRenewalRisk(endDate: Date): RenewalRisk {
  const daysUntilExpiry = differenceInDays(endDate, new Date());
  if (daysUntilExpiry <= 30) return 'CRITICAL';
  if (daysUntilExpiry <= 60) return 'HIGH';
  if (daysUntilExpiry <= 90) return 'MEDIUM';
  return 'LOW';
}

export async function getLeases(query: LeaseQuery) {
  const { page, limit, status, renewalRisk, propertyId, tenantId, expiringWithinDays, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.LeaseWhereInput = {
    ...(status && { status }),
    ...(renewalRisk && { renewalRisk }),
    ...(propertyId && { propertyId }),
    ...(tenantId && { tenantId }),
    ...(expiringWithinDays && {
      endDate: { lte: addDays(new Date(), expiringWithinDays) },
      status: 'ACTIVE',
    }),
    ...(search && {
      OR: [
        { leaseNumber: { contains: search, mode: 'insensitive' } },
        { tenant: { name: { contains: search, mode: 'insensitive' } } },
        { property: { name: { contains: search, mode: 'insensitive' } } },
        { unitNumber: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [leases, total] = await Promise.all([
    prisma.lease.findMany({
      where,
      skip,
      take: limit,
      orderBy: { endDate: 'asc' },
      include: {
        property: { select: { id: true, name: true, code: true } },
        tenant: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.lease.count({ where }),
  ]);

  return { leases, total };
}

export async function getLeaseById(id: string) {
  const lease = await prisma.lease.findUnique({
    where: { id },
    include: {
      property: true,
      tenant: true,
      financialRecords: { orderBy: { periodStart: 'desc' }, take: 12 },
      alerts: { where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!lease) throw new NotFoundError('Lease');
  return lease;
}

export async function createLease(input: CreateLeaseInput) {
  const endDate = parseISO(input.endDate);
  const renewalRisk = computeRenewalRisk(endDate);
  const leaseNumber = `LSE-${Date.now().toString(36).toUpperCase()}`;

  return prisma.lease.create({
    data: {
      leaseNumber,
      renewalRisk,
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      unitNumber: input.unitNumber,
      type: input.type,
      baseRent: input.baseRent,
      rentEscalation: input.rentEscalation,
      securityDeposit: input.securityDeposit,
      sqft: input.sqft,
      notes: input.notes,
      startDate: parseISO(input.startDate),
      endDate,
      renewalDate: input.renewalDate ? parseISO(input.renewalDate) : undefined,
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateLease(id: string, input: UpdateLeaseInput) {
  await getLeaseById(id);

  const endDate = input.endDate ? parseISO(input.endDate) : undefined;
  const renewalRisk = endDate ? computeRenewalRisk(endDate) : input.renewalRisk;

  const { startDate, endDate: endDateStr, renewalDate, propertyId, tenantId, terms, ...rest } = input;
  return prisma.lease.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate && { startDate: parseISO(startDate) }),
      ...(endDate && { endDate }),
      ...(renewalDate && { renewalDate: parseISO(renewalDate) }),
      ...(renewalRisk && { renewalRisk }),
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function deleteLease(id: string) {
  await getLeaseById(id);
  return prisma.lease.delete({ where: { id } });
}

export async function getLeaseStats() {
  const now = new Date();
  const [byStatus, byRisk, expiringIn30, expiringIn90, totalActive] = await Promise.all([
    prisma.lease.groupBy({ by: ['status'], _count: true }),
    prisma.lease.groupBy({ by: ['renewalRisk'], where: { status: 'ACTIVE' }, _count: true }),
    prisma.lease.count({ where: { status: 'ACTIVE', endDate: { lte: addDays(now, 30) } } }),
    prisma.lease.count({ where: { status: 'ACTIVE', endDate: { lte: addDays(now, 90) } } }),
    prisma.lease.count({ where: { status: 'ACTIVE' } }),
  ]);

  return { byStatus, byRisk, expiringIn30, expiringIn90, totalActive };
}

export async function refreshRenewalRisks(): Promise<number> {
  const activeLeases = await prisma.lease.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, endDate: true },
  });

  let updated = 0;
  for (const lease of activeLeases) {
    const newRisk = computeRenewalRisk(lease.endDate);
    await prisma.lease.update({ where: { id: lease.id }, data: { renewalRisk: newRisk } });
    updated++;
  }

  return updated;
}
