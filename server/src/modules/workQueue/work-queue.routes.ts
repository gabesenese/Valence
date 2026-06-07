import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';
import { getWorkQueue } from './work-queue.service';

const router = Router();

router.use(authenticate);

router.get('/brief', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = await getWorkQueue({ userId: req.user!.id });

    const now = new Date();
    const hour = now.getHours();
    const greeting =
      hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const critical  = items.filter((i) => i.severity === 'CRITICAL');
    const warning   = items.filter((i) => i.severity === 'WARNING');
    const overdue   = items.filter((i) => i.type === 'OVERDUE_INVOICE');
    const leases    = items.filter((i) => i.type === 'LEASE_EXPIRATION' && (i.daysUntilExpiry ?? 999) <= 30);
    const totalRisk = items.reduce((sum, i) => sum + i.monthlyRisk, 0);

    let headline: string;
    if (items.length === 0) {
      headline = 'Portfolio is clear — no items requiring attention today.';
    } else if (critical.length > 0) {
      headline = `${critical.length} critical item${critical.length > 1 ? 's' : ''} require your attention today.`;
    } else {
      headline = `${items.length} item${items.length > 1 ? 's' : ''} in your queue — ${warning.length} need follow-up.`;
    }

    sendSuccess(res, {
      greeting: `${greeting}, ${req.user!.firstName}`,
      headline,
      stats: {
        critical: critical.length,
        warning: warning.length,
        total: items.length,
        totalMonthlyRisk: Math.round(totalRisk),
        urgentLeases: leases.length,
        overduePayments: overdue.length,
      },
      topItems: items.slice(0, 3),
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const myWork = req.query.myWork === 'true';
    const result = await getWorkQueue({
      userId: req.user!.id,
      ...(myWork ? { assignedToUserId: req.user!.id } : {}),
    });
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
});

export { router as workQueueRouter };
