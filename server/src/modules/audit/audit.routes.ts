import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { getAuditLogs } from './audit.service';
import { sendPaginated } from '../../utils/response';

export const auditRouter = Router();

auditRouter.use(authenticate);
auditRouter.use(authorize('ADMIN'));

auditRouter.get('/', async (req, res, next) => {
  try {
    const { entity, action, page, limit } = req.query as Record<string, string>;
    const { logs, total } = await getAuditLogs(req.user!.id, {
      entity,
      action,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
    const p = parseInt(page ?? '1');
    const l = parseInt(limit ?? '50');
    sendPaginated(res, logs, total, p, l);
  } catch (err) { next(err); }
});
