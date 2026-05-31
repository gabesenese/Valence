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
