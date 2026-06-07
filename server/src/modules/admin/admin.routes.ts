import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { env } from '../../config/env';
import { sendSuccess } from '../../utils/response';
import { ForbiddenError } from '../../utils/errors';
import * as authService from '../auth/auth.service';

const router = Router();

// Extra secret gate on top of SUPER_ADMIN role
function requireAdminSecret(req: Request, _res: Response, next: NextFunction) {
  if (!env.PLATFORM_ADMIN_SECRET) return next();
  if (req.headers['x-admin-secret'] !== env.PLATFORM_ADMIN_SECRET) {
    return next(new ForbiddenError('Invalid admin secret'));
  }
  next();
}

router.use(authenticate, authorize('SUPER_ADMIN'), requireAdminSecret);

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const day  = new Date(now); day.setDate(day.getDate() - 1);
    const week = new Date(now); week.setDate(week.getDate() - 7);
    const month= new Date(now); month.setDate(month.getDate() - 30);

    const [
      totalUsers,
      byPlan,
      signupsToday,
      signups7d,
      signups30d,
      activeTrials,
      emailVerified,
      mfaEnabled,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
      prisma.user.count({ where: { createdAt: { gte: day } } }),
      prisma.user.count({ where: { createdAt: { gte: week } } }),
      prisma.user.count({ where: { createdAt: { gte: month } } }),
      prisma.user.count({ where: { trialEndsAt: { gte: now } } }),
      prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      prisma.user.count({ where: { mfaEnabled: true } }),
    ]);

    const planMap = Object.fromEntries(byPlan.map((r) => [r.plan, r._count._all]));

    sendSuccess(res, {
      totalUsers,
      byPlan: planMap,
      signupsToday,
      signups7d,
      signups30d,
      activeTrials,
      emailVerified,
      mfaEnabled,
    });
  } catch (err) { next(err); }
});

// ─── User list ────────────────────────────────────────────────────────────────

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || '';
    const plan   = (req.query.plan as string)   || '';
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 50);
    const skip   = (page - 1) * limit;

    const where = {
      ...(search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(plan ? { plan: plan as never } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          plan: true,
          role: true,
          isActive: true,
          emailVerifiedAt: true,
          mfaEnabled: true,
          trialEndsAt: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: { ownedProperties: true, ownedLeases: true, ownedTenants: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    sendSuccess(res, { users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ─── Change plan ──────────────────────────────────────────────────────────────

router.patch('/users/:id/plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan } = req.body;
    const user = await authService.setPlan(req.params.id, plan);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

// ─── Change role ──────────────────────────────────────────────────────────────

router.patch('/users/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    const user = await authService.updateUserRole(req.params.id, role);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

// ─── Toggle active ────────────────────────────────────────────────────────────

router.patch('/users/:id/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = req.body;
    const user = await authService.setUserActive(req.params.id, isActive);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

// ─── Send password reset ──────────────────────────────────────────────────────

router.post('/users/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id }, select: { email: true } });
    await authService.forgotPassword(user.email);
    sendSuccess(res, { message: 'Password reset email sent' });
  } catch (err) { next(err); }
});

// ─── Delete user ──────────────────────────────────────────────────────────────

router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (id === req.user!.id) {
      return next(new ForbiddenError('Cannot delete your own account from admin panel'));
    }

    await prisma.$transaction(async (tx) => {
      // Null out non-cascading FK references before deleting the user
      await tx.lease.updateMany({ where: { ownerUserId: id }, data: { ownerUserId: null } });
      await tx.alert.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.alert.updateMany({ where: { acknowledgedById: id }, data: { acknowledgedById: null } });
      await tx.alert.updateMany({ where: { dismissedById: id }, data: { dismissedById: null } });
      await tx.alertActivity.updateMany({ where: { actorUserId: id }, data: { actorUserId: null } });
      await tx.leaseActivity.updateMany({ where: { actorUserId: id }, data: { actorUserId: null } });
      await tx.leaseNote.updateMany({ where: { authorUserId: id }, data: { authorUserId: null } });
      await tx.task.updateMany({ where: { assigneeUserId: id }, data: { assigneeUserId: null } });
      await tx.task.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.task.updateMany({ where: { completedById: id }, data: { completedById: null } });
      await tx.insight.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.document.updateMany({ where: { uploadedById: id }, data: { uploadedById: null } });
      await tx.automationRule.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.contactLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.tenant.updateMany({ where: { assignedManagerId: id }, data: { assignedManagerId: null } });
      // Delete the user — RefreshTokens/PasswordResetTokens/EmailVerificationTokens/UsageRecords cascade
      await tx.user.delete({ where: { id } });
    });

    sendSuccess(res, { message: 'User deleted' });
  } catch (err) { next(err); }
});

export { router as adminRouter };
