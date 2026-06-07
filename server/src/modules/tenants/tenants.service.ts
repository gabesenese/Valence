import { prisma } from '../../infrastructure/database';
import { NotFoundError } from '../../utils/errors';

export async function getTenants(
  query: { page?: number; limit?: number; search?: string; isActive?: boolean },
  userId: string,
) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    ownerId: userId,
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { company: { contains: query.search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { leases: { where: { status: 'ACTIVE' } } } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  return { tenants, total };
}

export interface CreateTenantInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  taxId?: string;
  creditScore?: number;
  notes?: string;
  isActive?: boolean;
}

export async function createTenant(input: CreateTenantInput, userId: string) {
  if (input.email) {
    const existing = await prisma.tenant.findFirst({ where: { email: input.email, ownerId: userId } });
    if (existing) throw new Error(`A tenant with email "${input.email}" already exists`);
  }
  return prisma.tenant.create({ data: { ...input, ownerId: userId } });
}

export async function updateTenant(id: string, input: Partial<CreateTenantInput>, userId: string) {
  await getTenantById(id);
  if (input.email) {
    const conflict = await prisma.tenant.findFirst({ where: { email: input.email, ownerId: userId, NOT: { id } } });
    if (conflict) throw new Error(`A tenant with email "${input.email}" already exists`);
  }
  return prisma.tenant.update({ where: { id }, data: input });
}

export async function getTenantById(id: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      leases: {
        orderBy: { endDate: 'asc' },
        include: { property: { select: { id: true, name: true, code: true } } },
      },
      _count: { select: { leases: true } },
    },
  });
  if (!tenant) throw new NotFoundError('Tenant');
  return tenant;
}
