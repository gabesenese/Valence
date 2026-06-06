import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess } from '../../utils/response';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, { tokens });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.body.refreshToken);
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await authService.listUsers());
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.body as { role: string };
    const user = await authService.updateUserRole(
      req.params.id,
      role as import('@prisma/client').UserRole,
    );
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function setUserActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { isActive } = req.body as { isActive: boolean };
    const user = await authService.setUserActive(req.params.id, isActive);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function setUserPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { plan } = req.body as { plan: import('@prisma/client').Plan };
    await authService.setPlan(req.params.id, plan);
    sendSuccess(res, { plan });
  } catch (err) {
    next(err);
  }
}
