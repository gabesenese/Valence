import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { prisma } from '../../infrastructure/database';
import { env } from '../../config/env';
import { ConflictError, UnauthorizedError, NotFoundError, ValidationError } from '../../utils/errors';
import { logAudit } from '../audit/audit.service';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../lib/email';
import { DemoPortfolioFactory } from '../demo/demo.factory';
import { trackEvent } from '../analytics/funnel.service';
import type { RegisterInput, LoginInput } from './auth.schemas';
import type { UserRole, Plan } from '@prisma/client';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  plan: Plan;
  trialEndsAt: Date | null;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  isDemo: boolean;
}

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, plan: true, trialEndsAt: true,
  emailVerifiedAt: true, mfaEnabled: true, isDemo: true,
} as const;

function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      mfaEnabled: user.mfaEnabled,
      firstName: user.firstName,
      lastName: user.lastName,
      isDemo: user.isDemo,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

function signRefreshToken(): string {
  return uuidv4() + '.' + uuidv4();
}

export async function register(input: RegisterInput, meta?: SessionMeta): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('Email already registered');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const isOwner = env.OWNER_EMAIL && input.email.toLowerCase() === env.OWNER_EMAIL.toLowerCase();

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      ...(isOwner ? { role: 'SUPER_ADMIN' } : {}),
    },
    select: USER_SELECT,
  });

  void sendEmailVerificationLink(user.id, user.email);
  void trackEvent('signup', user.id);

  const tokens = await createTokenPair(user, meta);
  return { user, tokens };
}

export async function login(
  input: LoginInput & { totp?: string },
  meta?: SessionMeta,
): Promise<{ user: AuthUser; tokens: TokenPair } | { mfaRequired: true; mfaToken: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...USER_SELECT, passwordHash: true, isActive: true, mfaSecret: true },
  });

  if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  if (user.mfaEnabled && user.mfaSecret) {
    if (!input.totp) {
      const mfaToken = jwt.sign(
        { sub: user.id, type: 'mfa_challenge' },
        env.JWT_SECRET,
        { expiresIn: '5m' },
      );
      return { mfaRequired: true, mfaToken };
    }
    const ok = speakeasy.totp.verify({ token: input.totp, secret: user.mfaSecret, encoding: 'base32', window: 1 });
    if (!ok) throw new UnauthorizedError('Invalid authenticator code');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { passwordHash: _, isActive: __, mfaSecret: ___, ...authUser } = user;
  const tokens = await createTokenPair(authUser, meta);
  return { user: authUser, tokens };
}

export async function refresh(token: string, meta?: SessionMeta): Promise<TokenPair> {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: { select: { ...USER_SELECT, isActive: true } } },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (!storedToken.user.isActive) throw new UnauthorizedError('Account inactive');

  await prisma.refreshToken.update({ where: { id: storedToken.id }, data: { revokedAt: new Date() } });

  return createTokenPair(storedToken.user, meta);
}

export async function logout(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function listUsers(): Promise<(AuthUser & { isActive: boolean; lastLoginAt: Date | null; createdAt: Date })[]> {
  return prisma.user.findMany({
    select: { ...USER_SELECT, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
}

export async function updateUserRole(
  targetUserId: string,
  role: UserRole,
) {
  return prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });
}

export async function setUserActive(targetUserId: string, isActive: boolean) {
  return prisma.user.update({
    where: { id: targetUserId },
    data: { isActive },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });
}

export async function setPlan(targetUserId: string, plan: Plan, actorId?: string) {
  const user = await prisma.user.update({ where: { id: targetUserId }, data: { plan }, select: USER_SELECT });
  void logAudit({ userId: actorId, action: 'PLAN_CHANGE', entity: 'user', entityId: targetUserId, entityName: user.email, changes: { plan } });
  return user;
}

export async function updateProfile(userId: string, firstName: string, lastName: string): Promise<AuthUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { firstName: firstName.trim(), lastName: lastName.trim() },
    select: USER_SELECT,
  });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function changeEmail(userId: string, newEmail: string, currentPassword: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new NotFoundError('User');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');
  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) throw new ConflictError('Email already in use');
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { email: newEmail, emailVerifiedAt: null },
    select: USER_SELECT,
  });
  void sendEmailVerificationLink(userId, newEmail);
  return updated;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new NotFoundError('User');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function claimTrial(userId: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { trialEndsAt: true } });
  if (!existing) throw new NotFoundError('User');
  if (existing.trialEndsAt !== null) throw new ConflictError('Trial already claimed');
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const user = await prisma.user.update({ where: { id: userId }, data: { trialEndsAt }, select: USER_SELECT });
  const tokens = await createTokenPair(user);
  return { user, tokens };
}

// ─── Forgot / reset password ──────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return; // silent — don't reveal if email exists

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = uuidv4();
  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const url = `${env.APP_URL}/auth/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, url);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ValidationError('Reset link is invalid or has expired');
  }
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

// ─── Email verification ───────────────────────────────────────────────────────

async function sendEmailVerificationLink(userId: string, email: string): Promise<void> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  const token = uuidv4();
  await prisma.emailVerificationToken.create({
    data: { token, userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  const url = `${env.APP_URL}/auth/verify-email?token=${token}`;
  await sendVerificationEmail(email, url);
}

export async function verifyEmail(token: string): Promise<void> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ValidationError('Verification link is invalid or has expired');
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
  if (!user) throw new NotFoundError('User');
  if (user.emailVerifiedAt) throw new ConflictError('Email already verified');
  await sendEmailVerificationLink(userId, user.email);
}

// ─── MFA / TOTP ───────────────────────────────────────────────────────────────

export async function setupMfa(userId: string): Promise<{ secret: string; otpauth: string; qrCode: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, mfaEnabled: true } });
  if (!user) throw new NotFoundError('User');
  if (user.mfaEnabled) throw new ConflictError('MFA is already enabled');
  const generated = speakeasy.generateSecret({ name: `Valence:${user.email}`, issuer: 'Valence' });
  const secret = generated.base32;
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret, mfaEnabled: false } });
  const otpauth = generated.otpauth_url ?? '';
  const qrCode = await qrcode.toDataURL(otpauth);
  return { secret, otpauth, qrCode };
}

export async function enableMfa(userId: string, totp: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ...USER_SELECT, mfaSecret: true } });
  if (!user) throw new NotFoundError('User');
  if (user.mfaEnabled) throw new ConflictError('MFA is already enabled');
  if (!user.mfaSecret) throw new ValidationError('Run MFA setup first');
  const ok = speakeasy.totp.verify({ token: totp, secret: user.mfaSecret, encoding: 'base32', window: 1 });
  if (!ok) throw new UnauthorizedError('Invalid authenticator code');
  const updated = await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true }, select: USER_SELECT });
  return updated;
}

export async function disableMfa(userId: string, totp: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ...USER_SELECT, mfaSecret: true } });
  if (!user) throw new NotFoundError('User');
  if (!user.mfaEnabled || !user.mfaSecret) throw new ValidationError('MFA is not enabled');
  const ok = speakeasy.totp.verify({ token: totp, secret: user.mfaSecret, encoding: 'base32', window: 1 });
  if (!ok) throw new UnauthorizedError('Invalid authenticator code');
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null },
    select: USER_SELECT,
  });
  return updated;
}

export async function verifyMfaChallenge(
  mfaToken: string,
  totp: string,
  meta?: SessionMeta,
): Promise<{ user: AuthUser; tokens: TokenPair }> {
  let payload: { sub: string; type: string };
  try {
    payload = jwt.verify(mfaToken, env.JWT_SECRET) as { sub: string; type: string };
  } catch {
    throw new UnauthorizedError('MFA session expired — please log in again');
  }
  if (payload.type !== 'mfa_challenge') throw new UnauthorizedError('Invalid MFA token');

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { ...USER_SELECT, mfaSecret: true, isActive: true },
  });
  if (!user || !user.isActive) throw new UnauthorizedError('Account inactive');
  if (!user.mfaSecret) throw new UnauthorizedError('MFA not configured');

  const ok = speakeasy.totp.verify({ token: totp, secret: user.mfaSecret, encoding: 'base32', window: 1 });
  if (!ok) throw new UnauthorizedError('Invalid authenticator code');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { mfaSecret: _, isActive: __, ...authUser } = user;
  const tokens = await createTokenPair(authUser, meta);
  return { user: authUser, tokens };
}

// ─── Session management ───────────────────────────────────────────────────────

export async function listSessions(userId: string) {
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.refreshToken.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new NotFoundError('Session');
  await prisma.refreshToken.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

// ─── Demo session ─────────────────────────────────────────────────────────────

export async function demoLogin(meta?: SessionMeta): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const email = `demo-${uuidv4().slice(0, 8)}@valence.demo`;
  const passwordHash = await bcrypt.hash(uuidv4(), 4); // never used — throwaway

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
      plan: 'PROFESSIONAL',
      role: 'ADMIN',
      isDemo: true,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    },
    select: USER_SELECT,
  });

  await new DemoPortfolioFactory().create(user.id);
  void trackEvent('demo_started', user.id);

  const tokens = await createTokenPair(user, meta);
  return { user, tokens };
}

export async function cleanupDemoAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const stale = await prisma.user.findMany({
    where: { isDemo: true, createdAt: { lt: cutoff } },
    select: { id: true },
  });

  const factory = new DemoPortfolioFactory();
  let cleaned = 0;
  for (const { id } of stale) {
    try {
      await factory.reset(id);
      await prisma.$transaction([
        prisma.refreshToken.deleteMany({ where: { userId: id } }),
        prisma.usageRecord.deleteMany({ where: { userId: id } }),
        prisma.auditLog.deleteMany({ where: { userId: id } }),
      ]);
      await prisma.user.delete({ where: { id } });
      cleaned++;
    } catch { /* skip if already gone */ }
  }
  return cleaned;
}

// ─── Token pair ───────────────────────────────────────────────────────────────

async function createTokenPair(user: AuthUser, meta?: SessionMeta): Promise<TokenPair> {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
    },
  });

  return { accessToken, refreshToken };
}
