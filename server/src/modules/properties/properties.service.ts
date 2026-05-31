import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import type { CreatePropertyInput, UpdatePropertyInput, PropertyQuery } from './properties.schemas';

export async function getProperties(query: PropertyQuery) {
  const { page, limit, status, type, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.PropertyWhereInput = {
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
        _count: { select: { leases: { where: { status: 'ACTIVE' } } } },
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
        where: { status: 'ACTIVE' },
        include: { tenant: true },
        orderBy: { endDate: 'asc' },
      },
      _count: { select: { leases: true, alerts: { where: { status: 'OPEN' } } } },
    },
  });
  if (!property) throw new NotFoundError('Property');
  return property;
}

export async function createProperty(input: CreatePropertyInput) {
  const existing = await prisma.property.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError(`Property code "${input.code}" already exists`);

  return prisma.property.create({
    data: {
      ...input,
      totalSqft: input.totalSqft,
      purchasePrice: input.purchasePrice,
      currentValue: input.currentValue,
    },
  });
}

export async function updateProperty(id: string, input: UpdatePropertyInput) {
  await getPropertyById(id);

  if (input.code) {
    const conflict = await prisma.property.findFirst({ where: { code: input.code, NOT: { id } } });
    if (conflict) throw new ConflictError(`Property code "${input.code}" already exists`);
  }

  return prisma.property.update({ where: { id }, data: input });
}

export async function deleteProperty(id: string) {
  await getPropertyById(id);
  return prisma.property.delete({ where: { id } });
}

export async function getPropertySummary() {
  const [total, byStatus, byType] = await Promise.all([
    prisma.property.count(),
    prisma.property.groupBy({ by: ['status'], _count: true }),
    prisma.property.groupBy({ by: ['type'], _count: true }),
  ]);

  return { total, byStatus, byType };
}
