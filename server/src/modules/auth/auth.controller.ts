import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess } from '../../utils/response';
import { ForbiddenError } from '../../utils/errors';

function sessionMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent']?.slice(0, 255),
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip,
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body, sessionMeta(req));
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body, sessionMeta(req));
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await authService.refresh(req.body.refreshToken, sessionMeta(req));
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

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await authService.listUsers({ id: req.user!.id, role: req.user!.role }));
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.body as { role: string };
    if (role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only a platform owner can grant Super Admin.');
    }
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

export async function updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { alertEmailOptIn } = req.body as { alertEmailOptIn?: boolean };
    const user = await authService.updatePreferences(req.user!.id, { alertEmailOptIn });
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


export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.forgotPassword((req.body as { email: string }).email);
    sendSuccess(res, { message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    if (!token || !newPassword) {
      res.status(400).json({ success: false, message: 'Token and new password are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }
    await authService.resetPassword(token, newPassword);
    sendSuccess(res, { message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}


export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.verifyEmail((req.query as { token?: string }).token ?? '');
    sendSuccess(res, { message: 'Email verified' });
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resendVerification(req.user!.id);
    sendSuccess(res, { message: 'Verification email sent' });
  } catch (err) {
    next(err);
  }
}


export async function setupMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await authService.setupMfa(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function enableMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.enableMfa(req.user!.id, (req.body as { totp: string }).totp);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function disableMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.disableMfa(req.user!.id, (req.body as { totp: string }).totp);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function verifyMfaChallenge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mfaToken, totp } = req.body as { mfaToken: string; totp: string };
    const result = await authService.verifyMfaChallenge(mfaToken, totp, sessionMeta(req));
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}


export async function listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await authService.listSessions(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.revokeSession(req.user!.id, req.params.id);
    sendSuccess(res, { message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
}

export async function revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.revokeAllSessions(req.user!.id);
    sendSuccess(res, { message: 'All sessions revoked' });
  } catch (err) {
    next(err);
  }
}


export async function demoLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.demoLogin(sessionMeta(req));
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}
