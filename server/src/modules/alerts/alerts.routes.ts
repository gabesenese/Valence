import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as service from './alerts.service';
import { runAnomalyScan } from './anomaly.service';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess, sendPaginated } from '../../utils/response';

const router = Router();

router.use(authenticate);

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getAlertSummary(req.user!.id)); } catch (e) { next(e); }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      type: req.query.type as never,
      severity: req.query.severity as never,
      status: req.query.status as never,
      statuses: req.query.statuses
        ? (req.query.statuses as string).split(',') as never[]
        : undefined,
      propertyId: req.query.propertyId as string | undefined,
      leaseId: req.query.leaseId as string | undefined,
    };
    const { alerts, total } = await service.getAlerts(query, req.user!.id);
    sendPaginated(res, alerts, total, query.page, query.limit);
  } catch (e) { next(e); }
});

router.get('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await service.getAlertActivity(req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.progressAlert(req.params.id, req.user!.id));
  } catch (e) { next(e); }
});

router.post('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = req.body?.note as string | undefined;
    sendSuccess(res, await service.resolveAlert(req.params.id, req.user!.id, note));
  } catch (e) { next(e); }
});

router.post('/:id/dismiss', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = req.body?.note as string | undefined;
    sendSuccess(res, await service.dismissAlert(req.params.id, req.user!.id, note));
  } catch (e) { next(e); }
});

router.post('/:id/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assigneeUserId } = req.body as { assigneeUserId: string };
    sendSuccess(res, await service.assignAlert(req.params.id, assigneeUserId, req.user!.id));
  } catch (e) { next(e); }
});

router.post('/:id/reopen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.reopenAlert(req.params.id, req.user!.id));
  } catch (e) { next(e); }
});

router.post('/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await service.acknowledgeAlert(req.params.id, req.user!.id));
  } catch (e) { next(e); }
});

router.post('/scan', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runAnomalyScan();
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

export { router as alertsRouter };
