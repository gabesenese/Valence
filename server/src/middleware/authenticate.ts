import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../infrastructure/database';
import { UnauthorizedError } from '../utils/errors';
import type { UserRole, Plan } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  plan: Plan;
  trialEndsAt: string | null;
  firstName: string;
  lastName: string;
  impersonatedBy?: string;
  iat: number;
  exp: number;
}

export function tryAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as JwtPayload;
      req.user = {
        id: payload.sub, email: payload.email, role: payload.role,
        plan: payload.plan ?? 'ESSENTIALS', trialEndsAt: payload.trialEndsAt ?? null,
        firstName: payload.firstName, lastName: payload.lastName,
        impersonatedBy: payload.impersonatedBy,
      };
    } catch { /* ignore — treat as unauthenticated */ }
  }
  next();
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed authorization header'));
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as JwtPayload;
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  try {
    /*
     * Re-check the account against the DB on every request: a stateless JWT
     * would otherwise let a deactivated/deleted user, or a stale role, keep
     * access until the token expires. Role and plan are taken from the DB
     * (authoritative), so a deactivation or role change takes effect at once.
     */
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, role: true, plan: true, trialEndsAt: true },
    });
    if (!user || !user.isActive) {
      return next(new UnauthorizedError('Session is no longer valid'));
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: user.role,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      firstName: payload.firstName,
      lastName: payload.lastName,
      impersonatedBy: payload.impersonatedBy,
    };
    next();
  } catch (err) {
    next(err);
  }
}
