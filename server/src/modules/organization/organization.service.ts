import { prisma } from '../../infrastructure/database';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';

export async function getOrganization() {
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({ data: {} });
  }
  return org;
}

export async function updateOrganization(data: {
  name?: string;
  industry?: string | null;
  timezone?: string;
  currency?: string;
}) {
  const org = await getOrganization();
  return prisma.organization.update({ where: { id: org.id }, data });
}

export async function transferOwnership(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new UnauthorizedError('Cannot transfer ownership to yourself');
  }

  const toUser = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!toUser) throw new NotFoundError('User');
  if (!toUser.isActive) throw new UnauthorizedError('Cannot transfer ownership to an inactive user');

  await prisma.$transaction([
    prisma.user.update({ where: { id: toUserId }, data: { role: 'SUPER_ADMIN' } }),
    prisma.user.update({ where: { id: fromUserId }, data: { role: 'ADMIN' } }),
  ]);
}
