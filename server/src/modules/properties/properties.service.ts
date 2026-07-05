import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { trackIfFirstTime } from '../analytics/funnel.service';
import type { CreatePropertyInput, UpdatePropertyInput, PropertyQuery } from './properties.schemas';

function isDuplicateCode(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

export async function getProperties(query: PropertyQuery, userId: string) {
  const { page, limit, status, type, search, vacant } = query;
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

  const include = {
    _count: { select: { leases: { where: { status: 'ACTIVE', deletedAt: null } } } },
  } satisfies Prisma.PropertyInclude;

  // Vacancy (activeLeases < totalUnits) can't be expressed in a Prisma `where`
  // (relation count vs. scalar field), so filter in memory. Owner property sets
  // are bounded, and this only runs when the vacant filter is active.
  if (vacant) {
    const all = await prisma.property.findMany({ where, orderBy: { createdAt: 'desc' }, include });
    const vacantProps = all.filter((p) => p._count.leases < p.totalUnits);
    return { properties: vacantProps.slice(skip, skip + limit), total: vacantProps.length };
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include }),
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

  try {
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
  } catch (e) {
    if (isDuplicateCode(e)) throw new ConflictError(`Property code "${input.code}" already exists`);
    throw e;
  }
}

export async function updateProperty(id: string, input: UpdatePropertyInput, userId: string) {
  await getPropertyById(id);

  if (input.code) {
    const conflict = await prisma.property.findFirst({ where: { code: input.code, ownerId: userId, NOT: { id }, deletedAt: null } });
    if (conflict) throw new ConflictError(`Property code "${input.code}" already exists`);
  }

  try {
    return await prisma.property.update({ where: { id }, data: input });
  } catch (e) {
    if (isDuplicateCode(e)) throw new ConflictError(`Property code "${input.code}" already exists`);
    throw e;
  }
}

export async function deleteProperty(id: string) {
  await getPropertyById(id);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.lease.updateMany({ where: { propertyId: id, deletedAt: null }, data: { deletedAt: now } });
    await tx.task.updateMany({ where: { deletedAt: null, OR: [{ propertyId: id }, { lease: { propertyId: id } }] }, data: { deletedAt: now } });
    await tx.alert.updateMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ACKNOWLEDGED'] }, OR: [{ propertyId: id }, { lease: { propertyId: id } }] }, data: { status: 'DISMISSED', dismissedAt: now } });
    return tx.property.update({ where: { id }, data: { deletedAt: now } });
  });
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
