import { prisma } from '../../infrastructure/database';
import { ACTIVE_LEASE_COUNT } from '../metrics/portfolio-metrics';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { trackIfFirstTime } from '../analytics/funnel.service';
import { encryptField, decryptField, encryptNumber, decryptNumber } from '../../security/field-encryption';

function decryptTenant<T extends { taxId: string | null; creditScore: string | null }>(tenant: T) {
  return { ...tenant, taxId: decryptField(tenant.taxId), creditScore: decryptNumber(tenant.creditScore) };
}

export async function getTenants(
  query: { page?: number; limit?: number; search?: string; isActive?: boolean },
  userId: string,
) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    ownerId: userId,
    deletedAt: null,
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
        _count: ACTIVE_LEASE_COUNT,
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  return { tenants: tenants.map(decryptTenant), total };
}

export type CreditScoreSource = 'MANUAL' | 'EQUIFAX' | 'TRANSUNION';

export interface CreateTenantInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  taxId?: string;
  creditScore?: number;
  creditScoreSource?: CreditScoreSource;
  creditScoreDate?: string | Date;
  notes?: string;
  isActive?: boolean;
}

function normalizeDates<T extends Partial<CreateTenantInput>>(input: T): T {
  if (input.creditScoreDate && typeof input.creditScoreDate === 'string') {
    return { ...input, creditScoreDate: new Date(input.creditScoreDate) };
  }
  return input;
}

export async function createTenant(input: CreateTenantInput, userId: string) {
  if (input.email) {
    const existing = await prisma.tenant.findFirst({ where: { email: input.email, ownerId: userId } });
    if (existing) throw new ConflictError(`A tenant with email "${input.email}" already exists`);
  }
  const { taxId, creditScore, ...rest } = normalizeDates(input);
  const tenant = await prisma.tenant.create({
    data: { ...rest, ownerId: userId, taxId: encryptField(taxId), creditScore: encryptNumber(creditScore) },
  });
  void trackIfFirstTime('data_imported', userId, { source: 'manual', entity: 'tenant' });
  return decryptTenant(tenant);
}

export async function updateTenant(id: string, input: Partial<CreateTenantInput>, userId: string) {
  await getTenantById(id);
  if (input.email) {
    const conflict = await prisma.tenant.findFirst({ where: { email: input.email, ownerId: userId, NOT: { id } } });
    if (conflict) throw new ConflictError(`A tenant with email "${input.email}" already exists`);
  }
  const { taxId, creditScore, ...rest } = normalizeDates(input);
  const data: Record<string, unknown> = { ...rest };
  if ('taxId' in input) data.taxId = encryptField(taxId);
  if ('creditScore' in input) data.creditScore = encryptNumber(creditScore);
  return decryptTenant(await prisma.tenant.update({ where: { id }, data }));
}

export async function getTenantById(id: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      leases: {
        where: { deletedAt: null },
        orderBy: { endDate: 'asc' },
        include: { property: { select: { id: true, name: true, code: true } } },
      },
      _count: { select: { leases: { where: { deletedAt: null } } } },
    },
  });
  if (!tenant || tenant.deletedAt) throw new NotFoundError('Tenant');
  return decryptTenant(tenant);
}

export async function deleteTenant(id: string) {
  await getTenantById(id);
  return decryptTenant(await prisma.tenant.update({ where: { id }, data: { deletedAt: new Date() } }));
}
