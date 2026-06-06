import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import type { UserRole, Plan } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  plan: Plan;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed authorization header'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      plan: payload.plan ?? 'ESSENTIALS',
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
