import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { addonGate } from '../../middleware/addonGate';
import { VALENCE_COPILOT } from '../plans/addons';
import { sendSuccess } from '../../utils/response';
import { ValidationError } from '../../utils/errors';
import { isCopilotEnabled } from './flags';
import { generateCopilotBrief } from './copilot-brief.service';
import { answerFinanceQuestion, assertAskQuota } from './copilot-ask.service';
import { generateObservations } from './copilot-observations.service';

const MAX_QUESTION_LENGTH = 500;

const router = Router();
router.use(authenticate);

function requireCopilotEnabled(_req: Request, res: Response, next: NextFunction): void {
  if (!isCopilotEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
}

router.get('/brief', requireCopilotEnabled, addonGate(VALENCE_COPILOT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await generateCopilotBrief(req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.get('/observations', requireCopilotEnabled, addonGate(VALENCE_COPILOT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await generateObservations(req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.post('/ask', requireCopilotEnabled, addonGate(VALENCE_COPILOT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) throw new ValidationError('A question is required.');
    if (question.length > MAX_QUESTION_LENGTH) throw new ValidationError(`Questions are limited to ${MAX_QUESTION_LENGTH} characters.`);
    await assertAskQuota(req.user!.id);
    sendSuccess(res, await answerFinanceQuestion(req.user!.id, question));
  } catch (e) {
    next(e);
  }
});

export { router as copilotRouter };
