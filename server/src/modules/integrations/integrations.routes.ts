import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { resolveEffectivePlan } from '../../middleware/planGate';
import { sendSuccess } from '../../utils/response';
import * as service from './integrations.service';

const router = Router();
router.use(authenticate);

function effectivePlan(req: Request) {
  return resolveEffectivePlan(req.user?.plan ?? 'FREE', req.user?.trialEndsAt ?? null);
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.listIntegrations(req.user!.id)); } catch (e) { next(e); }
});

router.get('/:provider/authorize', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getAuthorizeUrl(req.user!.id, effectivePlan(req), req.params.provider)); } catch (e) { next(e); }
});

router.post('/:provider/connect', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.connectIntegration(req.user!.id, effectivePlan(req), req.params.provider, req.body?.config)); } catch (e) { next(e); }
});

router.post('/:provider/sync', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.syncIntegration(req.user!.id, effectivePlan(req), req.params.provider)); } catch (e) { next(e); }
});

router.get('/:provider/history', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getSyncHistory(req.user!.id, req.params.provider)); } catch (e) { next(e); }
});

router.delete('/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.disconnectIntegration(req.user!.id, req.params.provider)); } catch (e) { next(e); }
});

export { router as integrationsRouter };
