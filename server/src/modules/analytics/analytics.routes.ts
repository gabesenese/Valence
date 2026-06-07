import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as service from './analytics.service';
import { getBenchmarks } from './benchmark.service';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';

const router = Router();

router.use(authenticate);

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getExecutiveSummary(req.user!.id)); } catch (e) { next(e); }
});

router.get('/lease-distribution', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getLeaseDistribution(req.user!.id)); } catch (e) { next(e); }
});

router.get('/property-performance', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getPropertyPerformance(req.user!.id)); } catch (e) { next(e); }
});

router.get('/revenue-trend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = Number(req.query.months) || 12;
    sendSuccess(res, await service.getRevenueTrend(months, req.user!.id));
  } catch (e) { next(e); }
});

router.get('/insights', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getInsights(req.user!.id)); } catch (e) { next(e); }
});

router.get('/benchmarks', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getBenchmarks()); } catch (e) { next(e); }
});

export { router as analyticsRouter };
