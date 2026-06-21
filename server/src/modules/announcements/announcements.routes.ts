import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const items = await prisma.announcement.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        target: { in: ['ALL', req.user!.plan] },
      },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

export { router as announcementsRouter };
