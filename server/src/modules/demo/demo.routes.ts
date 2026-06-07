import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';
import { DemoPortfolioFactory } from './demo.factory';
import { logger } from '../../utils/logger';

const router = Router();
router.use(authenticate);

const factory = new DemoPortfolioFactory();

// POST /demo/load — reset and seed demo portfolio
router.post('/load', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const result = await factory.create(userId);
    logger.info('Demo portfolio loaded', { userId, ...result });
    sendSuccess(res, { message: 'Demo portfolio loaded', ...result }, 201);
  } catch (err) {
    next(err);
  }
});

// POST /demo/reset — wipe all portfolio data
router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await factory.reset();
    logger.info('Demo portfolio reset', { userId: req.user!.id });
    sendSuccess(res, { message: 'Portfolio data cleared' });
  } catch (err) {
    next(err);
  }
});

export { router as demoRouter };
