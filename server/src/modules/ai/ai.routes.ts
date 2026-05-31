import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { insightEngine, riskEvaluator } from './ai.service';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';

const router = Router();

router.use(authenticate);

router.get('/insights/portfolio', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzePortfolio()); } catch (e) { next(e); }
});

router.get('/insights/property/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzeProperty(req.params.id)); } catch (e) { next(e); }
});

router.get('/insights/lease/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzeLease(req.params.id)); } catch (e) { next(e); }
});

router.get('/risk/lease/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await riskEvaluator.evaluateLeaseRisk(req.params.id)); } catch (e) { next(e); }
});

router.get('/risk/portfolio', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await riskEvaluator.evaluatePortfolioRisk()); } catch (e) { next(e); }
});

export { router as aiRouter };
