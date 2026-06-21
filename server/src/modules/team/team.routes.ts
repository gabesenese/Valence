import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendSuccess } from '../../utils/response';
import { trackEvent } from '../analytics/funnel.service';
import * as teamService from './team.service';
import type { UserRole } from '@prisma/client';

const router = Router();


router.get('/invites/validate/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await teamService.validateInviteToken(req.params.token));
  } catch (e) { next(e); }
});

router.post('/invites/accept/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await teamService.acceptInvite(req.params.token, req.body);
    sendSuccess(res, result, 201);
  } catch (e) { next(e); }
});


router.use(authenticate);

router.get('/invites', authorize('ADMIN', 'SUPER_ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await teamService.listInvites());
  } catch (e) { next(e); }
});

router.post('/invites', authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, role } = req.body as { email: string; role: UserRole };
    const invite = await teamService.createInvite(email, role, req.user!.id);
    void trackEvent('team_invited', req.user!.id);
    sendSuccess(res, invite, 201);
  } catch (e) { next(e); }
});

router.delete('/invites/:id', authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await teamService.revokeInvite(req.params.id);
    sendSuccess(res, { message: 'Invite revoked' });
  } catch (e) { next(e); }
});

export { router as teamRouter };
