import { prisma } from '../../infrastructure/database';

const PURGE_AFTER_DAYS = 30;

function purgeDeadline(deletedAt: Date): Date {
  const d = new Date(deletedAt);
  d.setDate(d.getDate() + PURGE_AFTER_DAYS);
  return d;
}

function daysLeft(deletedAt: Date): number {
  return Math.max(0, Math.ceil((purgeDeadline(deletedAt).getTime() - Date.now()) / 86_400_000));
}

export async function listTrash(userId: string) {
  const [properties, leases, tenants] = await Promise.all([
    prisma.property.findMany({
      where: { ownerId: userId, deletedAt: { not: null } },
      select: { id: true, name: true, code: true, type: true, city: true, state: true, deletedAt: true },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.lease.findMany({
      where: { property: { ownerId: userId }, deletedAt: { not: null } },
      select: {
        id: true, leaseNumber: true, baseRent: true, deletedAt: true,
        property: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true } },
      },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.tenant.findMany({
      where: { ownerId: userId, deletedAt: { not: null } },
      select: { id: true, name: true, email: true, company: true, deletedAt: true },
      orderBy: { deletedAt: 'desc' },
    }),
  ]);

  return {
    properties: properties.map((p) => ({ ...p, daysLeft: daysLeft(p.deletedAt!), purgesAt: purgeDeadline(p.deletedAt!) })),
    leases:     leases.map((l)     => ({ ...l, daysLeft: daysLeft(l.deletedAt!), purgesAt: purgeDeadline(l.deletedAt!) })),
    tenants:    tenants.map((t)    => ({ ...t, daysLeft: daysLeft(t.deletedAt!), purgesAt: purgeDeadline(t.deletedAt!) })),
  };
}

export async function restoreItem(type: 'property' | 'lease' | 'tenant', id: string, userId: string) {
  switch (type) {
    case 'property': {
      const item = await prisma.property.findFirst({ where: { id, ownerId: userId, deletedAt: { not: null } } });
      if (!item) throw new Error('Item not found in trash');
      return prisma.property.update({ where: { id }, data: { deletedAt: null } });
    }
    case 'lease': {
      const item = await prisma.lease.findFirst({ where: { id, property: { ownerId: userId }, deletedAt: { not: null } } });
      if (!item) throw new Error('Item not found in trash');
      return prisma.lease.update({ where: { id }, data: { deletedAt: null } });
    }
    case 'tenant': {
      const item = await prisma.tenant.findFirst({ where: { id, ownerId: userId, deletedAt: { not: null } } });
      if (!item) throw new Error('Item not found in trash');
      return prisma.tenant.update({ where: { id }, data: { deletedAt: null } });
    }
  }
}

export async function permanentlyDelete(type: 'property' | 'lease' | 'tenant', id: string, userId: string) {
  switch (type) {
    case 'property': {
      const item = await prisma.property.findFirst({ where: { id, ownerId: userId, deletedAt: { not: null } } });
      if (!item) throw new Error('Item not found in trash');
      return prisma.property.delete({ where: { id } });
    }
    case 'lease': {
      const item = await prisma.lease.findFirst({ where: { id, property: { ownerId: userId }, deletedAt: { not: null } } });
      if (!item) throw new Error('Item not found in trash');
      return prisma.lease.delete({ where: { id } });
    }
    case 'tenant': {
      const item = await prisma.tenant.findFirst({ where: { id, ownerId: userId, deletedAt: { not: null } } });
      if (!item) throw new Error('Item not found in trash');
      return prisma.tenant.delete({ where: { id } });
    }
  }
}

export async function emptyTrash(userId: string) {
  const [properties, leases, tenants] = await Promise.all([
    prisma.property.findMany({ where: { ownerId: userId, deletedAt: { not: null } }, select: { id: true } }),
    prisma.lease.findMany({ where: { property: { ownerId: userId }, deletedAt: { not: null } }, select: { id: true } }),
    prisma.tenant.findMany({ where: { ownerId: userId, deletedAt: { not: null } }, select: { id: true } }),
  ]);

  await Promise.all([
    prisma.lease.deleteMany({ where: { id: { in: leases.map((l) => l.id) } } }),
    prisma.tenant.deleteMany({ where: { id: { in: tenants.map((t) => t.id) } } }),
  ]);
  await prisma.property.deleteMany({ where: { id: { in: properties.map((p) => p.id) } } });

  return { deleted: { properties: properties.length, leases: leases.length, tenants: tenants.length } };
}

export async function purgeStaleTrashed(): Promise<void> {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 86_400_000);

  const leases = await prisma.lease.findMany({ where: { deletedAt: { lte: cutoff } }, select: { id: true } });
  const tenants = await prisma.tenant.findMany({ where: { deletedAt: { lte: cutoff } }, select: { id: true } });
  const properties = await prisma.property.findMany({ where: { deletedAt: { lte: cutoff } }, select: { id: true } });

  if (leases.length)     await prisma.lease.deleteMany({ where: { id: { in: leases.map((l) => l.id) } } });
  if (tenants.length)    await prisma.tenant.deleteMany({ where: { id: { in: tenants.map((t) => t.id) } } });
  if (properties.length) await prisma.property.deleteMany({ where: { id: { in: properties.map((p) => p.id) } } });
}
