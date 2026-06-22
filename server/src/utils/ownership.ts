import { prisma } from '../infrastructure/database';
import { NotFoundError } from './errors';

/**
 * Ownership assertions for tenant isolation.
 *
 * Every entity ultimately belongs to a user: Property/Tenant via `ownerId`,
 * Lease/FinancialRecord via their `property.ownerId`. These helpers load only
 * the owner path and throw NotFoundError (never Forbidden) when the record is
 * missing OR owned by someone else — so a non-owner cannot distinguish "exists
 * but not yours" from "does not exist", preventing UUID enumeration.
 */

export async function assertPropertyOwner(id: string, userId: string): Promise<void> {
  const row = await prisma.property.findUnique({ where: { id }, select: { ownerId: true, deletedAt: true } });
  if (!row || row.deletedAt || row.ownerId !== userId) throw new NotFoundError('Property');
}

export async function assertLeaseOwner(id: string, userId: string): Promise<void> {
  const row = await prisma.lease.findUnique({ where: { id }, select: { property: { select: { ownerId: true } } } });
  if (!row || row.property.ownerId !== userId) throw new NotFoundError('Lease');
}

export async function assertTenantOwner(id: string, userId: string): Promise<void> {
  const row = await prisma.tenant.findUnique({ where: { id }, select: { ownerId: true } });
  if (!row || row.ownerId !== userId) throw new NotFoundError('Tenant');
}

export async function assertFinancialRecordOwner(id: string, userId: string): Promise<void> {
  const row = await prisma.financialRecord.findUnique({ where: { id }, select: { property: { select: { ownerId: true } } } });
  if (!row || row.property.ownerId !== userId) throw new NotFoundError('Financial record');
}

export async function assertAlertOwner(id: string, userId: string): Promise<void> {
  const row = await prisma.alert.findUnique({
    where: { id },
    select: {
      property: { select: { ownerId: true } },
      lease:    { select: { property: { select: { ownerId: true } } } },
    },
  });
  if (!row) throw new NotFoundError('Alert');
  const owned = row.property?.ownerId === userId || row.lease?.property.ownerId === userId;
  if (!owned) throw new NotFoundError('Alert');
}

export async function assertTaskOwner(id: string, userId: string): Promise<void> {
  const row = await prisma.task.findUnique({
    where: { id },
    select: {
      createdById:    true,
      assigneeUserId: true,
      property: { select: { ownerId: true } },
      lease:    { select: { property: { select: { ownerId: true } } } },
      alert:    { select: { property: { select: { ownerId: true } }, lease: { select: { property: { select: { ownerId: true } } } } } },
    },
  });
  if (!row) throw new NotFoundError('Task');
  const owned =
    row.createdById === userId ||
    row.assigneeUserId === userId ||
    row.property?.ownerId === userId ||
    row.lease?.property.ownerId === userId ||
    row.alert?.property?.ownerId === userId ||
    row.alert?.lease?.property.ownerId === userId;
  if (!owned) throw new NotFoundError('Task');
}

export async function assertDocumentOwner(id: string, userId: string): Promise<void> {
  const row = await prisma.document.findUnique({
    where: { id },
    select: {
      uploadedById: true,
      property: { select: { ownerId: true } },
      lease:    { select: { property: { select: { ownerId: true } } } },
      tenant:   { select: { ownerId: true } },
    },
  });
  if (!row) throw new NotFoundError('Document');
  const owned =
    row.uploadedById === userId ||
    row.property?.ownerId === userId ||
    row.lease?.property.ownerId === userId ||
    row.tenant?.ownerId === userId;
  if (!owned) throw new NotFoundError('Document');
}

export async function assertContactLogOwner(id: string, userId: string): Promise<void> {
  const row = await prisma.contactLog.findUnique({ where: { id }, select: { tenant: { select: { ownerId: true } } } });
  if (!row || row.tenant.ownerId !== userId) throw new NotFoundError('Contact log');
}

export const ownershipAsserters = {
  property:        assertPropertyOwner,
  lease:           assertLeaseOwner,
  tenant:          assertTenantOwner,
  financialRecord: assertFinancialRecordOwner,
  alert:           assertAlertOwner,
  task:            assertTaskOwner,
  document:        assertDocumentOwner,
  contactLog:      assertContactLogOwner,
} as const;

export type OwnedEntity = keyof typeof ownershipAsserters;
