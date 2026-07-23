import { prisma } from '../../infrastructure/database';
import { addDays } from 'date-fns';
import type { CrmStatus, ContactLogType } from '@prisma/client';
import { sendTenantEmail } from '../../lib/email';
import { ValidationError, NotFoundError } from '../../utils/errors';

const tenantCrmSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  creditScore: true,
  notes: true,
  isActive: true,
  crmStatus: true,
  renewalProbability: true,
  lastContactAt: true,
  createdAt: true,
  assignedManager: { select: { id: true, firstName: true, lastName: true, email: true } },
  leases: {
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      leaseNumber: true,
      baseRent: true,
      endDate: true,
      renewalRisk: true,
      renewalStage: true,
      property: { select: { id: true, name: true, code: true } },
    },
    orderBy: { endDate: 'asc' as const },
  },
  _count: {
    select: {
      contactLogs: true,
      leases: { where: { status: 'ACTIVE', deletedAt: null } },
    },
  },
} as const;

export async function getCrmTenants(userId: string, opts: {
  search?: string;
  crmStatus?: CrmStatus;
  assignedManagerId?: string;
  page?: number;
  limit?: number;
}) {
  const { search, crmStatus, assignedManagerId, page = 1, limit = 25 } = opts;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { ownerId: userId, deletedAt: null, isActive: true };
  if (crmStatus) where.crmStatus = crmStatus;
  if (assignedManagerId) where.assignedManagerId = assignedManagerId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
    ];
  }

  const now = new Date();
  const in90 = addDays(now, 90);

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        ...tenantCrmSelect,
        leases: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            leaseNumber: true,
            baseRent: true,
            endDate: true,
            renewalRisk: true,
            renewalStage: true,
            property: { select: { id: true, name: true, code: true } },
          },
          orderBy: { endDate: 'asc' },
        },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  return {
    data: tenants.map((t) => {
      const expiringSoon = t.leases.filter((l) => l.endDate <= in90).length;
      const totalRent = t.leases.reduce((s, l) => s + Number(l.baseRent), 0);
      return { ...t, expiringSoon, totalMonthlyRent: totalRent };
    }),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function getTenantCrmProfile(tenantId: string) {
  const now = new Date();
  const in90 = addDays(now, 90);

  const [tenant, recentContacts, openAlerts] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: tenantCrmSelect,
    }),
    prisma.contactLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        body: true,
        createdAt: true,
        leaseId: true,
        user: { select: { id: true, firstName: true, lastName: true } },
        lease: { select: { id: true, leaseNumber: true } },
      },
    }),
    prisma.alert.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        lease: { tenantId },
      },
    }),
  ]);

  const expiringSoon = tenant.leases.filter((l) => l.endDate <= in90).length;
  const totalMonthlyRent = tenant.leases.reduce((s, l) => s + Number(l.baseRent), 0);

  return {
    ...tenant,
    expiringSoon,
    totalMonthlyRent,
    openAlerts,
    recentContacts,
  };
}

export async function updateTenantCrm(
  tenantId: string,
  data: {
    crmStatus?: CrmStatus;
    renewalProbability?: number | null;
    assignedManagerId?: string | null;
    notes?: string;
  },
) {
  return prisma.tenant.update({
    where: { id: tenantId },
    data,
    select: {
      id: true,
      crmStatus: true,
      renewalProbability: true,
      assignedManagerId: true,
      notes: true,
      assignedManager: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getContactLogs(tenantId: string) {
  return prisma.contactLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      body: true,
      createdAt: true,
      leaseId: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      lease: { select: { id: true, leaseNumber: true } },
    },
  });
}

export async function createContactLog(
  tenantId: string,
  data: {
    type: ContactLogType;
    body: string;
    leaseId?: string;
    userId?: string;
  },
) {
  const log = await prisma.contactLog.create({
    data: { tenantId, ...data },
    select: {
      id: true,
      type: true,
      body: true,
      createdAt: true,
      leaseId: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      lease: { select: { id: true, leaseNumber: true } },
    },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { lastContactAt: new Date() },
  });

  return log;
}

export async function deleteContactLog(logId: string) {
  return prisma.contactLog.delete({ where: { id: logId } });
}

export async function emailTenant(
  tenantId: string,
  data: { subject: string; body: string; leaseId?: string; userId?: string; fromLabel: string },
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, email: true },
  });
  if (!tenant) throw new NotFoundError('Tenant');
  if (!tenant.email) throw new ValidationError('Tenant has no email address on file');

  await sendTenantEmail({ to: tenant.email, subject: data.subject, body: data.body, fromLabel: data.fromLabel });

  return createContactLog(tenantId, {
    type: 'EMAIL',
    body: `Subject: ${data.subject}\n\n${data.body}`,
    leaseId: data.leaseId,
    userId: data.userId,
  });
}
