import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendSuccess } from '../../utils/response';
import * as orgService from './organization.service';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await orgService.getOrganization(req.user!.id));
  } catch (e) { next(e); }
});

router.patch('/', authorize('ANALYST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, industry, timezone, currency } = req.body as {
      name?: string;
      industry?: string | null;
      timezone?: string;
      currency?: string;
    };
    sendSuccess(res, await orgService.updateOrganization(req.user!.id, { name, industry, timezone, currency }));
  } catch (e) { next(e); }
});

router.post('/transfer-ownership', authorize('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { toUserId } = req.body as { toUserId: string };
    await orgService.transferOwnership(req.user!.id, toUserId);
    sendSuccess(res, { message: 'Ownership transferred successfully' });
  } catch (e) { next(e); }
});

export { router as organizationRouter };
