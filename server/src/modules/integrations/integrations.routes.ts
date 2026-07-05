import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { resolveEffectivePlan } from '../../middleware/planGate';
import { sendSuccess } from '../../utils/response';
import { assertPropertyOwner } from '../../utils/ownership';
import * as service from './integrations.service';
import { getMappingQueue, createMapping, assignPending } from './mapping.service';

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

router.get('/:provider/mapping-queue', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getMappingQueue(req.user!.id, req.params.provider)); } catch (e) { next(e); }
});

router.post('/:provider/mappings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceType, sourceValue, propertyId } = req.body ?? {};
    if (propertyId) await assertPropertyOwner(propertyId, req.user!.id);
    sendSuccess(res, await createMapping(req.user!.id, req.params.provider, sourceType, sourceValue, propertyId));
  } catch (e) { next(e); }
});

router.post('/:provider/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, untaggedOnly, sourceType, sourceValue } = req.body ?? {};
    if (propertyId) await assertPropertyOwner(propertyId, req.user!.id);
    sendSuccess(res, await assignPending(req.user!.id, req.params.provider, propertyId, { untaggedOnly, sourceType, sourceValue }));
  } catch (e) { next(e); }
});

router.delete('/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.disconnectIntegration(req.user!.id, req.params.provider)); } catch (e) { next(e); }
});

export { router as integrationsRouter };
