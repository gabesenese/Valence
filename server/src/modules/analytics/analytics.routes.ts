import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as service from './analytics.service';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';

const router = Router();

router.use(authenticate);

router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getExecutiveSummary()); } catch (e) { next(e); }
});

router.get('/lease-distribution', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getLeaseDistribution()); } catch (e) { next(e); }
});

router.get('/property-performance', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getPropertyPerformance()); } catch (e) { next(e); }
});

router.get('/revenue-trend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = Number(req.query.months) || 12;
    sendSuccess(res, await service.getRevenueTrend(months));
  } catch (e) { next(e); }
});

export { router as analyticsRouter };
