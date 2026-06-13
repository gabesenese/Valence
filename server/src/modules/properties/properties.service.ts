import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { trackIfFirstTime } from '../analytics/funnel.service';
import type { CreatePropertyInput, UpdatePropertyInput, PropertyQuery } from './properties.schemas';

export async function getProperties(query: PropertyQuery, userId: string) {
  const { page, limit, status, type, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.PropertyWhereInput = {
    ownerId: userId,
    deletedAt: null,
    ...(status && { status }),
    ...(type && { type }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { leases: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
    }),
    prisma.property.count({ where }),
  ]);

  return { properties, total };
}

export async function getPropertyById(id: string) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      leases: {
        where: { status: 'ACTIVE', deletedAt: null },
        include: { tenant: true },
        orderBy: { endDate: 'asc' },
      },
      _count: { select: { leases: { where: { deletedAt: null } }, alerts: { where: { status: 'OPEN' } } } },
    },
  });
  if (!property || property.deletedAt) throw new NotFoundError('Property');
  return property;
}

export async function createProperty(input: CreatePropertyInput, userId: string) {
  const existing = await prisma.property.findFirst({ where: { code: input.code, ownerId: userId, deletedAt: null } });
  if (existing) throw new ConflictError(`Property code "${input.code}" already exists`);

  const property = await prisma.property.create({
    data: {
      ...input,
      ownerId: userId,
      totalSqft: input.totalSqft,
      purchasePrice: input.purchasePrice,
      currentValue: input.currentValue,
    },
  });
  void trackIfFirstTime('data_imported', userId, { source: 'manual', entity: 'property' });
  return property;
}

export async function updateProperty(id: string, input: UpdatePropertyInput, userId: string) {
  await getPropertyById(id);

  if (input.code) {
    const conflict = await prisma.property.findFirst({ where: { code: input.code, ownerId: userId, NOT: { id }, deletedAt: null } });
    if (conflict) throw new ConflictError(`Property code "${input.code}" already exists`);
  }

  return prisma.property.update({ where: { id }, data: input });
}

export async function deleteProperty(id: string) {
  await getPropertyById(id);
  return prisma.property.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function getPropertySummary(userId: string) {
  const ownerFilter = { ownerId: userId, deletedAt: null };
  const [total, byStatus, byType] = await Promise.all([
    prisma.property.count({ where: ownerFilter }),
    prisma.property.groupBy({ by: ['status'], where: ownerFilter, _count: true }),
    prisma.property.groupBy({ by: ['type'], where: ownerFilter, _count: true }),
  ]);

  return { total, byStatus, byType };
}
