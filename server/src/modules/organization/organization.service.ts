import { prisma } from '../../infrastructure/database';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';

export async function getOrganization(userId: string) {
  let org = await prisma.organization.findUnique({ where: { ownerId: userId } });
  if (!org) {
    org = await prisma.organization.create({ data: { ownerId: userId } });
  }
  return org;
}

/**
 * Returns the organization the user belongs to, creating and linking one
 * for legacy accounts that predate membership. Membership is the single
 * source of truth for team scoping — never fall back to platform-wide
 * queries when it is missing.
 */
export async function resolveOrganizationId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (user?.organizationId) return user.organizationId;
  const org = await getOrganization(userId);
  await prisma.user.update({ where: { id: userId }, data: { organizationId: org.id } });
  return org.id;
}

export async function updateOrganization(userId: string, data: {
  name?: string;
  industry?: string | null;
  timezone?: string;
  currency?: string;
}) {
  const org = await getOrganization(userId);
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
