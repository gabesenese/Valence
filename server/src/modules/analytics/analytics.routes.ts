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

router.get('/insights', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getInsights(req.user!.id)); } catch (e) { next(e); }
});

router.get('/benchmarks', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getBenchmarks(req.user!.id)); } catch (e) { next(e); }
});

export { router as analyticsRouter };
