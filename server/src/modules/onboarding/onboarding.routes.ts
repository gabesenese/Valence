import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getOnboardingProgress, getTipState, markTipSeen } from './onboarding.service';
import { sendSuccess } from '../../utils/response';
import { ValidationError } from '../../utils/errors';

const TIP_KEY = /^[a-z0-9._-]{1,48}$/;

const router = Router();
router.use(authenticate);

router.get('/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getOnboardingProgress(req.user!.id));
  } catch (e) { next(e); }
});

router.get('/tips', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getTipState(req.user!.id));
  } catch (e) { next(e); }
});

router.post('/tips/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.params.key;
    if (!TIP_KEY.test(key)) throw new ValidationError('Invalid tip key.');
    sendSuccess(res, { seenTips: await markTipSeen(req.user!.id, key) });
  } catch (e) { next(e); }
});

export { router as onboardingRouter };
