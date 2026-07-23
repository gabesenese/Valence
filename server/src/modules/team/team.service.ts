import crypto from 'crypto';
import { resolveOrganizationId } from '../organization/organization.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../infrastructure/database';
import { env } from '../../config/env';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import type { UserRole } from '@prisma/client';


export async function createInvite(email: string, role: UserRole, invitedById: string) {
  const normalEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalEmail } });
  if (existing) throw new ConflictError('A user with this email already exists');

  const pending = await prisma.invite.findFirst({
    where: { email: normalEmail, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pending) throw new ConflictError('An active invite for this email already exists');

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return prisma.invite.create({
    data: { email: normalEmail, role, token, invitedById, expiresAt },
    include: { invitedBy: { select: { firstName: true, lastName: true } } },
  });
}

export async function listInvites(invitedById: string) {
  return prisma.invite.findMany({
    where: { acceptedAt: null, invitedById },
    include: { invitedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeInvite(id: string, invitedById: string) {
  const invite = await prisma.invite.findFirst({ where: { id, invitedById } });
  if (!invite) throw new NotFoundError('Invite');
  await prisma.invite.delete({ where: { id } });
}

export async function validateInviteToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { invitedBy: { select: { firstName: true, lastName: true } } },
  });
  if (!invite) throw new NotFoundError('Invite link is invalid');
  if (invite.acceptedAt) throw new ConflictError('This invite has already been used');
  if (invite.expiresAt < new Date()) throw new UnauthorizedError('This invite has expired');
  return {
    email: invite.email,
    role: invite.role,
    invitedBy: invite.invitedBy,
    expiresAt: invite.expiresAt,
  };
}

export async function acceptInvite(
  token: string,
  input: { firstName: string; lastName: string; password: string },
) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) throw new NotFoundError('Invite link is invalid');
  if (invite.acceptedAt) throw new ConflictError('This invite has already been used');
  if (invite.expiresAt < new Date()) throw new UnauthorizedError('This invite has expired');

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existingUser) throw new ConflictError('An account with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  // New members join the inviter's organization — this is what makes them
  // appear in (and only in) that organization's team list.
  const organizationId = await resolveOrganizationId(invite.invitedById);

  const user = await prisma.user.create({
    data: {
      email: invite.email,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: invite.role,
      trialEndsAt,
      organizationId,
    },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, plan: true, trialEndsAt: true,
    },
  });

  await prisma.invite.update({ where: { token }, data: { acceptedAt: new Date() } });

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  const refreshToken = uuidv4() + '.' + uuidv4();
  const refreshExpiry = new Date();
  refreshExpiry.setDate(refreshExpiry.getDate() + 7);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry } });

  return { user, tokens: { accessToken, refreshToken } };
}
