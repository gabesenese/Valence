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

router.post('/transfer-ownership', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { toUserId } = req.body as { toUserId: string };
    await orgService.transferOwnership(req.user!.id, toUserId);
    sendSuccess(res, { message: 'Ownership transferred successfully' });
  } catch (e) { next(e); }
});

/*
 * No role gate beyond authentication: ownership is a per-user Organization.ownerId
 * relationship, not the SUPER_ADMIN role (which self-registered customers never
 * hold — only the platform owner's account does). deleteOrganization enforces
 * the real check itself.
 */
router.post('/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { confirmEmail } = req.body as { confirmEmail: string };
    await orgService.deleteOrganization(req.user!.id, confirmEmail);
    sendSuccess(res, { message: 'Organization deleted' });
  } catch (e) { next(e); }
});

export { router as organizationRouter };
