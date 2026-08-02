import { prisma } from '../../infrastructure/database';
import { NotFoundError, UnauthorizedError, ConflictError, ValidationError } from '../../utils/errors';
import { DemoPortfolioFactory } from '../demo/demo.factory';
import { cancelSubscription } from '../billing/billing.service';
import { logAudit } from '../audit/audit.service';

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

  const organizationId = await resolveOrganizationId(fromUserId);
  /*
   * The caller must actually be the current owner. Without this, any
   * ADMIN-level member of the org (not just its owner) could hand ownership
   * to someone else, since resolveOrganizationId only resolves the caller's
   * own org membership, not whether they own it.
   */
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } });
  if (org?.ownerId !== fromUserId) {
    throw new UnauthorizedError('Only the organization owner can transfer ownership');
  }

  /*
   * The recipient must be an active member of the caller's own organization so
   * that ownership can never cross a tenant boundary.
   */
  const toUser = await prisma.user.findFirst({
    where: { id: toUserId, organizationId },
    select: { id: true, isActive: true },
  });
  if (!toUser) throw new NotFoundError('User');
  if (!toUser.isActive) throw new UnauthorizedError('Cannot transfer ownership to an inactive user');

  await prisma.$transaction([
    prisma.user.update({ where: { id: toUserId }, data: { role: 'SUPER_ADMIN' } }),
    prisma.user.update({ where: { id: fromUserId }, data: { role: 'ADMIN' } }),
    prisma.organization.update({ where: { id: organizationId }, data: { ownerId: toUserId } }),
  ]);
}

/*
 * Self-service organization deletion: wipes the owner's portfolio, cancels
 * billing at period end, and deactivates the account rather than hard-deleting
 * it — deactivation is reversible by support and keeps audit-log attribution
 * intact for anything the owner touched historically.
 */
export async function deleteOrganization(userId: string, confirmEmail: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new NotFoundError('User');
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new ValidationError('Email confirmation does not match your account email.');
  }

  const organizationId = await resolveOrganizationId(userId);
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } });
  if (!org || org.ownerId !== userId) {
    throw new UnauthorizedError('Only the organization owner can delete the organization.');
  }

  const otherMembers = await prisma.user.count({
    where: { organizationId, id: { not: userId }, isActive: true },
  });
  if (otherMembers > 0) {
    throw new ConflictError('Remove your team members before deleting the organization.');
  }

  await new DemoPortfolioFactory().reset(userId);
  await cancelSubscription({ id: userId, email: user.email, firstName: '', lastName: '' });

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

  void logAudit({ userId, action: 'DELETE', entity: 'organization', entityId: organizationId, entityName: user.email });
}
