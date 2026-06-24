import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import os from 'os';
import v8 from 'node:v8';
import { prisma } from '../../infrastructure/database';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { env } from '../../config/env';
import { sendSuccess } from '../../utils/response';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import * as authService from '../auth/auth.service';
import { getFunnelStats } from '../analytics/funnel.service';
import { deleteProperty } from '../properties/properties.service';
import { deleteLease } from '../leases/leases.service';
import { deleteTenant } from '../tenants/tenants.service';
import { deleteTask } from '../tasks/tasks.service';
import { dismissAlert } from '../alerts/alerts.service';

const router = Router();

function requireAdminSecret(req: Request, _res: Response, next: NextFunction) {
  if (!env.PLATFORM_ADMIN_SECRET) return next();
  if (req.headers['x-admin-secret'] !== env.PLATFORM_ADMIN_SECRET) {
    return next(new ForbiddenError('Invalid admin secret'));
  }
  next();
}

router.use(authenticate, authorize('SUPER_ADMIN'), requireAdminSecret);


router.get('/funnel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(90, parseInt(req.query.days as string) || 30);
    sendSuccess(res, await getFunnelStats(days));
  } catch (err) { next(err); }
});


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


router.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();

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

    const byPlan = await prisma.user.groupBy({ by: ['plan'], _count: { _all: true }, where: { isActive: true } });
    const planPrices: Record<string, number> = { ESSENTIALS: 149, PROFESSIONAL: 499, EXECUTIVE: 1500 };
    const planDist: Record<string, number> = {};
    for (const p of byPlan) planDist[p.plan] = p._count._all; // account distribution (all active)

    // MRR counts only real paying customers — exclude demo, internal staff, and
    // internal/test email domains so test accounts and the owner don't inflate it.
    const INTERNAL_EMAIL = ['@test.com', '@demo.com', '@valence.dev', '@admin.com', 'valenceos.ca', 'idor-test', 'privaterelay.appleid.com', 'bru.dotac@gmail.com'];
    const payingByPlan = await prisma.user.groupBy({
      by: ['plan'], _count: { _all: true },
      where: {
        isActive: true, isDemo: false, role: { not: 'SUPER_ADMIN' },
        OR: [{ trialEndsAt: null }, { trialEndsAt: { lt: now } }],
        NOT: INTERNAL_EMAIL.map((d) => ({ email: { contains: d } })),
      },
    });
    const mrr = payingByPlan.reduce((s, p) => s + (planPrices[p.plan] ?? 0) * p._count._all, 0);

    const [totalWithTrial, totalActive] = await Promise.all([
      prisma.user.count({ where: { trialEndsAt: { not: null } } }),
      prisma.user.count({ where: { isActive: true } }),
    ]);
    const trialConvRate = totalWithTrial > 0 ? Math.round(((totalActive - totalWithTrial) / totalWithTrial) * 100) : 0;

    const [inactive14, inactive30, inactive60] = await Promise.all([
      prisma.user.count({ where: { lastLoginAt: { lt: new Date(now.getTime() - 14 * 86400000) }, isActive: true } }),
      prisma.user.count({ where: { lastLoginAt: { lt: new Date(now.getTime() - 30 * 86400000) }, isActive: true } }),
      prisma.user.count({ where: { lastLoginAt: { lt: new Date(now.getTime() - 60 * 86400000) }, isActive: true } }),
    ]);

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

    const [withProperties, withLeases, withAlerts, withTasks, withAI] = await Promise.all([
      prisma.property.groupBy({ by: ['ownerId'], _count: { _all: true } }).then((r) => r.length),
      prisma.lease.groupBy({ by: ['ownerUserId'] }).then((r) => r.length),
      prisma.alert.groupBy({ by: ['createdById'] }).then((r) => r.length),
      prisma.task.groupBy({ by: ['createdById'] }).then((r) => r.length),
      prisma.usageRecord.groupBy({ by: ['userId'] }).then((r) => r.length),
    ]);

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


router.get('/adoption', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, email: true, firstName: true, lastName: true, plan: true } });

    const props = await prisma.property.findMany({ where: { deletedAt: null }, select: { ownerId: true, _count: { select: { leases: { where: { deletedAt: null } }, financialRecords: true } } } });
    const byOwner = new Map<string, { props: number; fin: number }>();
    for (const p of props) {
      if (!p.ownerId) continue;
      const a = byOwner.get(p.ownerId) ?? { props: 0, fin: 0 };
      a.props += 1; a.fin += p._count.financialRecords;
      byOwner.set(p.ownerId, a);
    }

    const taskRows = await prisma.task.findMany({ where: { deletedAt: null }, select: { property: { select: { ownerId: true } } } });
    const tasksByOwner = new Map<string, number>();
    for (const t of taskRows) {
      const o = t.property?.ownerId;
      if (!o) continue;
      tasksByOwner.set(o, (tasksByOwner.get(o) ?? 0) + 1);
    }

    const [autoBy, aiBy] = await Promise.all([
      prisma.automationRule.groupBy({ by: ['createdById'], _count: { _all: true } }),
      prisma.usageRecord.groupBy({ by: ['userId'], _count: { _all: true } }),
    ]);
    const autoMap = new Map(autoBy.filter((r) => r.createdById).map((r) => [r.createdById as string, r._count._all]));
    const aiMap = new Map(aiBy.filter((r) => r.userId).map((r) => [r.userId as string, r._count._all]));

    const accounts = users.map((u) => {
      const a = byOwner.get(u.id) ?? { props: 0, fin: 0 };
      return {
        id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`.trim(), plan: u.plan,
        import: a.props > 0,
        finance: a.fin,
        workQueue: tasksByOwner.get(u.id) ?? 0,
        automation: autoMap.get(u.id) ?? 0,
        ai: aiMap.get(u.id) ?? 0,
      };
    });

    const n = accounts.length || 1;
    const pct = (f: (x: typeof accounts[number]) => boolean) => Math.round((accounts.filter(f).length / n) * 100);
    const summary = {
      total: accounts.length,
      import: pct((a) => a.import),
      finance: pct((a) => a.finance > 0),
      workQueue: pct((a) => a.workQueue > 0),
      automation: pct((a) => a.automation > 0),
      ai: pct((a) => a.ai > 0),
    };
    sendSuccess(res, { summary, accounts });
  } catch (err) { next(err); }
});


router.get('/customer-health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true, plan: true, trialEndsAt: true, lastLoginAt: true },
    });

    // One pass over properties → per-owner counts of properties, leases, finance records.
    const props = await prisma.property.findMany({
      where: { deletedAt: null },
      select: { ownerId: true, _count: { select: { leases: { where: { deletedAt: null } }, financialRecords: true } } },
    });
    const agg = new Map<string, { props: number; leases: number; fin: number }>();
    for (const p of props) {
      if (!p.ownerId) continue;
      const a = agg.get(p.ownerId) ?? { props: 0, leases: 0, fin: 0 };
      a.props += 1; a.leases += p._count.leases; a.fin += p._count.financialRecords;
      agg.set(p.ownerId, a);
    }

    const accounts = users.map((u) => {
      const a = agg.get(u.id) ?? { props: 0, leases: 0, fin: 0 };
      const hasProperties = a.props > 0, hasLeases = a.leases > 0, hasRevenue = a.fin > 0;
      const daysSinceLogin = u.lastLoginAt ? Math.floor((now.getTime() - u.lastLoginAt.getTime()) / 86400000) : null;

      const eng = daysSinceLogin === null ? 0
        : daysSinceLogin <= 7 ? 35 : daysSinceLogin <= 14 ? 20 : daysSinceLogin <= 30 ? 10 : 0;
      const score = Math.min(100, eng + (hasProperties ? 20 : 0) + (hasLeases ? 20 : 0) + (hasRevenue ? 25 : 0));
      const band = score >= 75 ? 'healthy' : score >= 45 ? 'watch' : 'at_risk';

      const risks: string[] = [];
      const trialDays = u.trialEndsAt ? Math.ceil((u.trialEndsAt.getTime() - now.getTime()) / 86400000) : null;
      if (trialDays !== null && trialDays >= 0 && trialDays <= 3) risks.push(`Trial ends in ${trialDays} day${trialDays === 1 ? '' : 's'}`);
      if (daysSinceLogin === null) risks.push('Never logged in');
      else if (daysSinceLogin > 12) risks.push(`Inactive ${daysSinceLogin} days`);
      if (!hasLeases) risks.push('No leases imported');
      if (!hasProperties && !hasLeases) risks.push('Never reached first insight');

      return {
        id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`.trim(), plan: u.plan,
        score, band,
        signals: { active: daysSinceLogin !== null && daysSinceLogin <= 7, hasProperties, hasLeases, hasRevenue },
        risks, lastLoginAt: u.lastLoginAt, trialEndsAt: u.trialEndsAt,
      };
    }).sort((x, y) => x.score - y.score);

    const summary = {
      total: accounts.length,
      healthy: accounts.filter((a) => a.band === 'healthy').length,
      watch: accounts.filter((a) => a.band === 'watch').length,
      atRisk: accounts.filter((a) => a.band === 'at_risk').length,
    };
    sendSuccess(res, { summary, accounts });
  } catch (err) { next(err); }
});


router.get('/revenue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const planPrices: Record<string, number> = { ESSENTIALS: 149, PROFESSIONAL: 499, EXECUTIVE: 1500 };

    // Real paying customers only. There's no Stripe subscription record yet and
    // `plan` defaults to ESSENTIALS on free signup, so exclude demo accounts,
    // internal staff (SUPER_ADMIN), and internal/test email domains — otherwise
    // test accounts and the owner inflate MRR/profit.
    const INTERNAL_EMAIL = ['@test.com', '@demo.com', '@valence.dev', '@admin.com', 'valenceos.ca', 'idor-test', 'privaterelay.appleid.com', 'bru.dotac@gmail.com'];
    const realAccount: Prisma.UserWhereInput = {
      isActive: true,
      isDemo: false,
      role: { not: 'SUPER_ADMIN' },
      NOT: INTERNAL_EMAIL.map((d) => ({ email: { contains: d } })),
    };
    // Paying = a real account that isn't currently inside a trial window.
    const payingFilter: Prisma.UserWhereInput = { ...realAccount, OR: [{ trialEndsAt: null }, { trialEndsAt: { lt: now } }] };
    const byPlan = await prisma.user.groupBy({ by: ['plan'], _count: { _all: true }, where: payingFilter });

    const planMix = byPlan
      .map((p) => ({ plan: p.plan, count: p._count._all, price: planPrices[p.plan] ?? 0, mrr: (planPrices[p.plan] ?? 0) * p._count._all }))
      .sort((a, b) => b.price - a.price);
    const mrr = planMix.reduce((s, p) => s + p.mrr, 0);
    const payingAccounts = planMix.reduce((s, p) => s + (p.price > 0 ? p.count : 0), 0);

    // Estimated monthly infrastructure cost. Replace with real billing data when wired.
    const costs = { vercel: 190, neon: 95, resend: 45, aiGateway: 135 };
    const totalCost = costs.vercel + costs.neon + costs.resend + costs.aiGateway;
    const netProfit = mrr - totalCost;
    const arpu = payingAccounts > 0 ? Math.round(mrr / payingAccounts) : 0;
    const margin = mrr > 0 ? Math.round((netProfit / mrr) * 1000) / 10 : 0;

    const [withTrial, activeTrials] = await Promise.all([
      prisma.user.count({ where: { ...realAccount, trialEndsAt: { not: null } } }),
      prisma.user.count({ where: { ...realAccount, trialEndsAt: { gte: now } } }),
    ]);
    const trialConvRate = withTrial > 0 ? Math.round((payingAccounts / withTrial) * 100) : 0;

    sendSuccess(res, {
      mrr, arr: mrr * 12, netProfit, margin, arpu,
      payingAccounts, activeTrials, trialConvRate,
      costs, totalCost, costEstimated: true,
      planMix,
    });
  } catch (err) { next(err); }
});


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
    const heapLimit = v8.getHeapStatistics().heap_size_limit;

    sendSuccess(res, {
      db: { users, properties, leases, tenants, alerts, tasks, financialRecords },
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        heapLimit: Math.round(heapLimit / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
        systemUsed: Math.round((totalMem - freeMem) / 1024 / 1024),
        systemTotal: Math.round(totalMem / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
      recentErrors,
    });
  } catch (err) { next(err); }
});


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


router.patch('/users/:id/plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.setPlan(req.params.id, req.body.plan);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});


router.patch('/users/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.updateUserRole(req.params.id, req.body.role);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});


router.patch('/users/:id/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.setUserActive(req.params.id, req.body.isActive);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});


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


router.post('/users/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id }, select: { email: true } });
    await authService.forgotPassword(user.email);
    sendSuccess(res, { message: 'Password reset email sent' });
  } catch (err) { next(err); }
});


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


// ─── Granular data management ────────────────────────────────────────────────

const openAlertScope = (userId: string): Prisma.AlertWhereInput => ({
  status: { in: ['OPEN', 'IN_PROGRESS', 'ACKNOWLEDGED'] },
  OR: [{ property: { ownerId: userId } }, { lease: { property: { ownerId: userId } } }],
});

router.get('/users/:id/data-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const [properties, leases, tenants, tasks, openAlerts, financialRecords] = await Promise.all([
      prisma.property.count({ where: { ownerId: id, deletedAt: null } }),
      prisma.lease.count({ where: { property: { ownerId: id }, deletedAt: null } }),
      prisma.tenant.count({ where: { ownerId: id, deletedAt: null } }),
      prisma.task.count({ where: { property: { ownerId: id }, deletedAt: null } }),
      prisma.alert.count({ where: openAlertScope(id) }),
      prisma.financialRecord.count({ where: { property: { ownerId: id } } }),
    ]);
    sendSuccess(res, { properties, leases, tenants, tasks, openAlerts, financialRecords });
  } catch (err) { next(err); }
});

router.get('/users/:id/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const [properties, tenants] = await Promise.all([
      prisma.property.findMany({ where: { ownerId: id, deletedAt: null }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
      prisma.tenant.findMany({ where: { ownerId: id, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    sendSuccess(res, { properties, tenants });
  } catch (err) { next(err); }
});

// Delete one record. Reuses the cascade-aware service deletes (so deleting a
// property still soft-deletes its leases/tasks and dismisses its alerts).
router.delete('/data/:type/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, id } = req.params;
    switch (type) {
      case 'property': await deleteProperty(id); break;
      case 'lease':    await deleteLease(id); break;
      case 'tenant':   await deleteTenant(id); break;
      case 'task':     await deleteTask(id); break;
      case 'alert':    await dismissAlert(id, req.user!.id); break;
      default: return next(new NotFoundError(`Unknown data type: ${type}`));
    }
    sendSuccess(res, { deleted: true, type, id });
  } catch (err) { next(err); }
});

// Wipe a user's entire portfolio but keep the account/login.
router.post('/users/:id/wipe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const financialRecords = await tx.financialRecord.deleteMany({ where: { property: { ownerId: id } } });
      const alerts = await tx.alert.updateMany({ where: openAlertScope(id), data: { status: 'DISMISSED', dismissedAt: now } });
      const tasks = await tx.task.updateMany({ where: { property: { ownerId: id }, deletedAt: null }, data: { deletedAt: now } });
      const leases = await tx.lease.updateMany({ where: { property: { ownerId: id }, deletedAt: null }, data: { deletedAt: now } });
      const tenants = await tx.tenant.updateMany({ where: { ownerId: id, deletedAt: null }, data: { deletedAt: now } });
      const properties = await tx.property.updateMany({ where: { ownerId: id, deletedAt: null }, data: { deletedAt: now } });
      // Reset account-level state so it's indistinguishable from a brand-new account
      // (default plan, no trial, cleared proactive-layer cursors). Login is kept.
      await tx.user.update({
        where: { id },
        data: { plan: 'FREE', trialEndsAt: null, lastChangesSeenAt: null, lastBriefSentAt: null, dailyBriefOptOut: false },
      });
      return { properties: properties.count, leases: leases.count, tenants: tenants.count, tasks: tasks.count, alerts: alerts.count, financialRecords: financialRecords.count };
    });
    sendSuccess(res, { wiped: true, reset: true, ...result });
  } catch (err) { next(err); }
});


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
