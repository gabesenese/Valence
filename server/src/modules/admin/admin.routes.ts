import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import os from 'os';
import { prisma } from '../../infrastructure/database';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { env } from '../../config/env';
import { sendSuccess } from '../../utils/response';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import * as authService from '../auth/auth.service';

const router = Router();

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
    const now  = new Date();
    const day  = new Date(now); day.setDate(day.getDate() - 1);
    const week = new Date(now); week.setDate(week.getDate() - 7);

    const [totalUsers, byPlan, signupsToday, signups7d, signups30d, activeTrials, emailVerified, mfaEnabled] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
        prisma.user.count({ where: { createdAt: { gte: day } } }),
        prisma.user.count({ where: { createdAt: { gte: week } } }),
        prisma.user.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } } }),
        prisma.user.count({ where: { trialEndsAt: { gte: now } } }),
        prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
        prisma.user.count({ where: { mfaEnabled: true } }),
      ]);

    sendSuccess(res, {
      totalUsers,
      byPlan: Object.fromEntries(byPlan.map((r) => [r.plan, r._count._all])),
      signupsToday, signups7d, signups30d, activeTrials, emailVerified, mfaEnabled,
    });
  } catch (err) { next(err); }
});

// ─── Analytics (revenue, cohorts, churn, adoption, slow accounts) ─────────────

router.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();

    // Signup trend — last 30 days
    const users30 = await prisma.user.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const signupsByDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      signupsByDay[d.toISOString().slice(0, 10)] = 0;
    }
    for (const u of users30) {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (key in signupsByDay) signupsByDay[key]++;
    }
    const signupTrend = Object.entries(signupsByDay).map(([date, count]) => ({ date, count }));

    // Revenue (pseudo-MRR from plan distribution)
    const byPlan = await prisma.user.groupBy({ by: ['plan'], _count: { _all: true }, where: { isActive: true } });
    const planPrices: Record<string, number> = { ESSENTIALS: 149, PROFESSIONAL: 499, EXECUTIVE: 1500 };
    let mrr = 0;
    const planDist: Record<string, number> = {};
    for (const p of byPlan) {
      planDist[p.plan] = p._count._all;
      mrr += (planPrices[p.plan] ?? 0) * p._count._all;
    }

    // Trial conversion: users who had trial but now have no trialEndsAt (converted)
    const [totalWithTrial, totalActive] = await Promise.all([
      prisma.user.count({ where: { trialEndsAt: { not: null } } }),
      prisma.user.count({ where: { isActive: true } }),
    ]);
    const trialConvRate = totalWithTrial > 0 ? Math.round(((totalActive - totalWithTrial) / totalWithTrial) * 100) : 0;

    // Churn signals — users with no login in 14/30/60 days
    const [inactive14, inactive30, inactive60] = await Promise.all([
      prisma.user.count({ where: { lastLoginAt: { lt: new Date(now.getTime() - 14 * 86400000) }, isActive: true } }),
      prisma.user.count({ where: { lastLoginAt: { lt: new Date(now.getTime() - 30 * 86400000) }, isActive: true } }),
      prisma.user.count({ where: { lastLoginAt: { lt: new Date(now.getTime() - 60 * 86400000) }, isActive: true } }),
    ]);

    // Cohorts — signups per week for last 12 weeks
    const cohortStart = new Date(now.getTime() - 12 * 7 * 86400000);
    const cohortUsers = await prisma.user.findMany({
      where: { createdAt: { gte: cohortStart } },
      select: { createdAt: true },
    });
    const cohortMap: Record<string, number> = {};
    for (const u of cohortUsers) {
      const d = new Date(u.createdAt);
      const mon = new Date(d); mon.setDate(d.getDate() - d.getDay());
      const key = mon.toISOString().slice(0, 10);
      cohortMap[key] = (cohortMap[key] ?? 0) + 1;
    }
    const cohorts = Object.entries(cohortMap)
      .map(([week, users]) => ({ week, users }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Feature adoption — count of users who have used each core feature
    const [withProperties, withLeases, withAlerts, withTasks, withAI] = await Promise.all([
      prisma.property.groupBy({ by: ['ownerId'], _count: { _all: true } }).then((r) => r.length),
      prisma.lease.groupBy({ by: ['ownerUserId'] }).then((r) => r.length),
      prisma.alert.groupBy({ by: ['createdById'] }).then((r) => r.length),
      prisma.task.groupBy({ by: ['createdById'] }).then((r) => r.length),
      prisma.usageRecord.groupBy({ by: ['userId'] }).then((r) => r.length),
    ]);

    // Slow accounts — top 5 by data volume
    const slowAccounts = await prisma.user.findMany({
      take: 5,
      orderBy: { ownedProperties: { _count: 'desc' } },
      select: {
        id: true, email: true, firstName: true, lastName: true, plan: true,
        _count: { select: { ownedProperties: true, ownedLeases: true, ownedTenants: true } },
      },
    });

    sendSuccess(res, {
      mrr, arr: mrr * 12, planDist, trialConvRate,
      signupTrend,
      churn: { inactive14, inactive30, inactive60 },
      cohorts,
      adoption: { withProperties, withLeases, withAlerts, withTasks, withAI },
      slowAccounts,
    });
  } catch (err) { next(err); }
});

// ─── System metrics ───────────────────────────────────────────────────────────

router.get('/system', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [users, properties, leases, tenants, alerts, tasks, financialRecords, recentErrors] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.lease.count(),
      prisma.tenant.count(),
      prisma.alert.count(),
      prisma.task.count(),
      prisma.financialRecord.count(),
      prisma.errorLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, method: true, path: true, status: true, message: true, userId: true, createdAt: true } }),
    ]);

    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();

    sendSuccess(res, {
      db: { users, properties, leases, tenants, alerts, tasks, financialRecords },
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
        systemUsed: Math.round((totalMem - freeMem) / 1024 / 1024),
        systemTotal: Math.round(totalMem / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
      recentErrors,
    });
  } catch (err) { next(err); }
});

// ─── Audit log ────────────────────────────────────────────────────────────────

router.get('/audit-log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    sendSuccess(res, { logs, total, page, pages: Math.ceil(total / limit) });
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
      ...(search ? { OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
      ] } : {}),
      ...(plan ? { plan: plan as never } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          plan: true, role: true, isActive: true, emailVerifiedAt: true,
          mfaEnabled: true, trialEndsAt: true, createdAt: true, lastLoginAt: true,
          _count: { select: { ownedProperties: true, ownedLeases: true, ownedTenants: true } },
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
    const user = await authService.setPlan(req.params.id, req.body.plan);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

// ─── Change role ──────────────────────────────────────────────────────────────

router.patch('/users/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.updateUserRole(req.params.id, req.body.role);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

// ─── Toggle active ────────────────────────────────────────────────────────────

router.patch('/users/:id/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.setUserActive(req.params.id, req.body.isActive);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

// ─── Set trial end date ───────────────────────────────────────────────────────

router.patch('/users/:id/trial', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trialEndsAt } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null },
      select: { id: true, email: true, trialEndsAt: true },
    });
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

// ─── Impersonate user ─────────────────────────────────────────────────────────

router.post('/users/:id/impersonate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.id) return next(new ForbiddenError('Cannot impersonate yourself'));
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, plan: true, trialEndsAt: true },
    });
    if (!target) return next(new NotFoundError('User not found'));

    const token = jwt.sign(
      {
        sub: target.id, email: target.email, role: target.role, plan: target.plan,
        trialEndsAt: target.trialEndsAt?.toISOString() ?? null,
        firstName: target.firstName, lastName: target.lastName,
        impersonatedBy: req.user!.id,
        emailVerifiedAt: null, mfaEnabled: false,
      },
      env.JWT_SECRET,
      { expiresIn: '2h' },
    );

    sendSuccess(res, { token, user: target });
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
    if (id === req.user!.id) return next(new ForbiddenError('Cannot delete your own account'));

    await prisma.$transaction(async (tx) => {
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
      await tx.user.delete({ where: { id } });
    });

    sendSuccess(res, { message: 'User deleted' });
  } catch (err) { next(err); }
});

// ─── Feature flags ────────────────────────────────────────────────────────────

router.get('/flags', async (_req, res, next) => {
  try {
    const flags = await prisma.featureFlag.findMany({ orderBy: { createdAt: 'asc' } });
    sendSuccess(res, flags);
  } catch (err) { next(err); }
});

router.post('/flags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, name, description, enabled, rules } = req.body;
    const flag = await prisma.featureFlag.create({ data: { key, name, description, enabled: !!enabled, rules: rules ?? [] } });
    sendSuccess(res, flag, 201);
  } catch (err) { next(err); }
});

router.patch('/flags/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, enabled, rules } = req.body;
    const flag = await prisma.featureFlag.update({
      where: { id: req.params.id },
      data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }), ...(enabled !== undefined && { enabled }), ...(rules !== undefined && { rules }) },
    });
    sendSuccess(res, flag);
  } catch (err) { next(err); }
});

router.delete('/flags/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.featureFlag.delete({ where: { id: req.params.id } });
    sendSuccess(res, { message: 'Flag deleted' });
  } catch (err) { next(err); }
});

// ─── Announcements ────────────────────────────────────────────────────────────

router.get('/announcements', async (_req, res, next) => {
  try {
    const items = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

router.post('/announcements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, body, type, target, active, startsAt, endsAt } = req.body;
    const item = await prisma.announcement.create({
      data: { title, body, type: type ?? 'INFO', target: target ?? 'ALL', active: active !== false, startsAt: startsAt ? new Date(startsAt) : new Date(), endsAt: endsAt ? new Date(endsAt) : null },
    });
    sendSuccess(res, item, 201);
  } catch (err) { next(err); }
});

router.patch('/announcements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, body, type, target, active, startsAt, endsAt } = req.body;
    const item = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }), ...(body !== undefined && { body }),
        ...(type !== undefined && { type }), ...(target !== undefined && { target }),
        ...(active !== undefined && { active }), ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
        ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
      },
    });
    sendSuccess(res, item);
  } catch (err) { next(err); }
});

router.delete('/announcements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    sendSuccess(res, { message: 'Announcement deleted' });
  } catch (err) { next(err); }
});

// ─── Maintenance mode ─────────────────────────────────────────────────────────

router.get('/maintenance', async (_req, res, next) => {
  try {
    const config = await prisma.systemConfig.findMany({ where: { key: { in: ['maintenance_enabled', 'maintenance_message'] } } });
    const map = Object.fromEntries(config.map((c) => [c.key, c.value]));
    sendSuccess(res, { enabled: map['maintenance_enabled'] === 'true', message: map['maintenance_message'] ?? '' });
  } catch (err) { next(err); }
});

router.patch('/maintenance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enabled, message } = req.body;
    await Promise.all([
      prisma.systemConfig.upsert({ where: { key: 'maintenance_enabled' }, create: { key: 'maintenance_enabled', value: String(!!enabled) }, update: { value: String(!!enabled) } }),
      prisma.systemConfig.upsert({ where: { key: 'maintenance_message' }, create: { key: 'maintenance_message', value: message ?? '' }, update: { value: message ?? '' } }),
    ]);
    sendSuccess(res, { enabled: !!enabled, message: message ?? '' });
  } catch (err) { next(err); }
});

export { router as adminRouter };
