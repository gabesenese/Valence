import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

/*
 * Blocks account-takeover-class actions (change password/email, MFA changes)
 * while a staff member is impersonating a user. Impersonation is for support/
 * debugging, not for silently seizing an account's credentials.
 */
export function blockWhileImpersonating(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.impersonatedBy) {
    return next(new ForbiddenError('This action is not available while impersonating a user.'));
  }
  next();
}
