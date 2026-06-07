import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';
import { getWorkQueue } from './work-queue.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const myWork = req.query.myWork === 'true';
    const result = await getWorkQueue({
      userId: req.user!.id,
      ...(myWork ? { assignedToUserId: req.user!.id } : {}),
    });
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
});

export { router as workQueueRouter };
