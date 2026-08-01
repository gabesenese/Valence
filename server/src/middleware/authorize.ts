import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  VIEWER: 0,
  ANALYST: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());

    const userLevel = ROLE_HIERARCHY[req.user.role];
    const hasAccess = allowedRoles.some((role) => userLevel >= ROLE_HIERARCHY[role]);

    if (!hasAccess) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

/*
 * Gate for the platform-admin surface. This is a tenancy boundary, not a rank
 * check: only Valence staff carry `isPlatformStaff`, and it is the one thing
 * that legitimately reaches across organizations. An organization owner is an
 * ADMIN of their own org and must never pass this.
 */
export function requirePlatformStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new UnauthorizedError());
  if (!req.user.isPlatformStaff) return next(new ForbiddenError('Platform staff only'));
  next();
}
