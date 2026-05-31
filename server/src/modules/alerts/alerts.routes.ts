import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as service from './alerts.service';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess, sendPaginated } from '../../utils/response';

const router = Router();

router.use(authenticate);

router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getAlertSummary()); } catch (e) { next(e); }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      type: req.query.type as never,
      severity: req.query.severity as never,
      status: req.query.status as never,
      propertyId: req.query.propertyId as string | undefined,
    };
    const { alerts, total } = await service.getAlerts(query);
    sendPaginated(res, alerts, total, query.page, query.limit);
  } catch (e) { next(e); }
});

router.post('/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.acknowledgeAlert(req.params.id, req.user!.id));
  } catch (e) { next(e); }
});

router.post('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.resolveAlert(req.params.id, req.user!.id));
  } catch (e) { next(e); }
});

router.post('/generate-lease-alerts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await service.generateLeaseExpirationAlerts();
    sendSuccess(res, { generated: count });
  } catch (e) { next(e); }
});

export { router as alertsRouter };
