import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOwner } from '../../middleware/ownership';
import { sendSuccess } from '../../utils/response';
import {
  getCrmTenants,
  getTenantCrmProfile,
  updateTenantCrm,
  getContactLogs,
  createContactLog,
  deleteContactLog,
} from './crm.service';
import type { CrmStatus, ContactLogType } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, crmStatus, assignedManagerId, page, limit } =
      req.query as Record<string, string | undefined>;
    const result = await getCrmTenants({
      search,
      crmStatus: crmStatus as CrmStatus | undefined,
      assignedManagerId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

router.get('/tenants/:id', requireOwner('tenant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getTenantCrmProfile(req.params.id);
    sendSuccess(res, profile);
  } catch (e) { next(e); }
});

router.patch('/tenants/:id', authorize('ANALYST'), requireOwner('tenant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { crmStatus, renewalProbability, assignedManagerId, notes } = req.body as {
      crmStatus?: CrmStatus;
      renewalProbability?: number | null;
      assignedManagerId?: string | null;
      notes?: string;
    };
    const updated = await updateTenantCrm(req.params.id, {
      crmStatus,
      renewalProbability,
      assignedManagerId,
      notes,
    });
    sendSuccess(res, updated);
  } catch (e) { next(e); }
});

router.get('/tenants/:id/contacts', requireOwner('tenant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await getContactLogs(req.params.id);
    sendSuccess(res, logs);
  } catch (e) { next(e); }
});

router.post('/tenants/:id/contacts', authorize('ANALYST'), requireOwner('tenant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, body, leaseId } = req.body as {
      type: ContactLogType;
      body: string;
      leaseId?: string;
    };

    const validTypes: ContactLogType[] = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'SITE_VISIT'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid contact type' });
      return;
    }
    if (!body?.trim()) {
      res.status(400).json({ success: false, message: 'body is required' });
      return;
    }

    const log = await createContactLog(req.params.id, {
      type,
      body: body.trim(),
      leaseId,
      userId: req.user!.id,
    });
    res.status(201).json({ success: true, data: log });
  } catch (e) { next(e); }
});

router.delete('/contacts/:logId', authorize('ADMIN'), requireOwner('contactLog', 'logId'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteContactLog(req.params.logId);
    sendSuccess(res, { deleted: true });
  } catch (e) { next(e); }
});

export { router as crmRouter };
