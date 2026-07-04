import { prisma } from '../../infrastructure/database';
import { unlink } from 'fs/promises';
import path from 'path';
import type { DocumentType } from '@prisma/client';

const docSelect = {
  id: true,
  name: true,
  originalName: true,
  type: true,
  mimeType: true,
  size: true,
  path: true,
  propertyId: true,
  leaseId: true,
  tenantId: true,
  createdAt: true,
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
  property:   { select: { id: true, name: true, code: true } },
  lease:      { select: { id: true, leaseNumber: true } },
  tenant:     { select: { id: true, name: true } },
} as const;

export async function createDocument(data: {
  name: string;
  originalName: string;
  type: DocumentType;
  mimeType: string;
  size: number;
  path: string;
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  uploadedById?: string;
}) {
  return prisma.document.create({ data, select: docSelect });
}

export async function getDocuments(
  filter: {
    propertyId?: string;
    leaseId?: string;
    tenantId?: string;
    type?: DocumentType;
  },
  userId: string,
) {
  const where: Record<string, unknown> = {
    OR: [
      { uploadedById: userId },
      { property: { ownerId: userId } },
      { lease: { property: { ownerId: userId } } },
      { tenant: { ownerId: userId } },
    ],
  };
  if (filter.propertyId) where.propertyId = filter.propertyId;
  if (filter.leaseId)    where.leaseId    = filter.leaseId;
  if (filter.tenantId)   where.tenantId   = filter.tenantId;
  if (filter.type)       where.type       = filter.type;

  return prisma.document.findMany({
    where,
    select: docSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDocument(id: string) {
  return prisma.document.findUniqueOrThrow({ where: { id }, select: docSelect });
}

export async function deleteDocument(id: string) {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id } });
  await prisma.document.delete({ where: { id } });

  try {
    await unlink(path.resolve(doc.path));
  } catch { /* ignore */ }

  return { deleted: true };
}
