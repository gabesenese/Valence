import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';
import { DemoPortfolioFactory } from './demo.factory';
import { trackIfFirstTime } from '../analytics/funnel.service';
import { logger } from '../../utils/logger';

const router = Router();
router.use(authenticate);

const factory = new DemoPortfolioFactory();

router.post('/load', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const result = await factory.create(userId);
    void trackIfFirstTime('demo_started', userId, { source: 'activation' });
    logger.info('Demo portfolio loaded', { userId, ...result });
    sendSuccess(res, { message: 'Demo portfolio loaded', ...result }, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await factory.reset(req.user!.id);
    logger.info('Demo portfolio reset', { userId: req.user!.id });
    sendSuccess(res, { message: 'Portfolio data cleared' });
  } catch (err) {
    next(err);
  }
});

export { router as demoRouter };
