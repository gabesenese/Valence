import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

// authenticate() re-checks isDemo against the DB on every request, so this is
// a plain, no-extra-query check — never trust a value carried on the JWT
// alone. Must run after authenticate() on any route it guards.
export function blockDemo(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new UnauthorizedError());
  if (req.user.isDemo) {
    return next(new ForbiddenError('This action is not available in the demo portfolio.'));
  }
  next();
}
