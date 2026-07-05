import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../infrastructure/database';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export async function blockDemo(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) return next(new UnauthorizedError());
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isDemo: true } });
    if (user?.isDemo) {
      next(new ForbiddenError('This action is not available in the demo portfolio.'));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
