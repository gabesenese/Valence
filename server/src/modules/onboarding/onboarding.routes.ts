import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getOnboardingProgress } from './onboarding.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate);

router.get('/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getOnboardingProgress(req.user!.id));
  } catch (e) { next(e); }
});

export { router as onboardingRouter };
