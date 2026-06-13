import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Sentry } from '../lib/sentry';
import { prisma } from '../infrastructure/database';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack, path: req.path });
    }
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  Sentry.captureException(err);

  prisma.errorLog.create({ data: {
    method: req.method, path: req.path, status: 500, message: err.message,
    stack: err.stack?.slice(0, 2000),
    userId: (req as { user?: { id: string } }).user?.id ?? null,
  } }).catch(() => {});

  res.status(500).json({
    success: false,
    message: err.message,
    code: 'INTERNAL_ERROR',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}
