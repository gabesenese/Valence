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

export async function claimTrial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.claimTrial(req.user!.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { firstName, lastName } = req.body as { firstName: string; lastName: string };
    if (!firstName?.trim() || !lastName?.trim()) {
      res.status(400).json({ success: false, message: 'First and last name are required' });
      return;
    }
    const user = await authService.updateProfile(req.user!.id, firstName, lastName);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function changeEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, currentPassword } = req.body as { email: string; currentPassword: string };
    if (!email?.trim() || !currentPassword) {
      res.status(400).json({ success: false, message: 'Email and current password are required' });
      return;
    }
    const user = await authService.changeEmail(req.user!.id, email.trim().toLowerCase(), currentPassword);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current and new password are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      return;
    }
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    sendSuccess(res, { message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}
