import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendSuccess } from '../../utils/response';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  runRule,
  getAutomationLogs,
} from './automation.service';
import type { AutomationTrigger, AutomationAction } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await getRules({ id: req.user!.id, role: req.user!.role });
    sendSuccess(res, rules);
  } catch (e) { next(e); }
});

router.post('/rules', authorize('ANALYST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, trigger, conditions, action, actionConfig } = req.body as {
      name: string;
      description?: string;
      trigger: AutomationTrigger;
      conditions: Record<string, unknown>;
      action: AutomationAction;
      actionConfig: Record<string, unknown>;
    };

    if (!name?.trim() || !trigger || !action) {
      res.status(400).json({ success: false, message: 'name, trigger, and action are required' });
      return;
    }

    const rule = await createRule({
      name: name.trim(),
      description,
      trigger,
      conditions,
      action,
      actionConfig: actionConfig ?? {},
      createdById: req.user!.id,
    });

    res.status(201).json({ success: true, data: rule });
  } catch (e) { next(e); }
});

router.patch('/rules/:id', authorize('ANALYST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await updateRule(req.params.id, req.body, { id: req.user!.id, role: req.user!.role });
    sendSuccess(res, rule);
  } catch (e) { next(e); }
});

router.delete('/rules/:id', authorize('ANALYST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteRule(req.params.id, { id: req.user!.id, role: req.user!.role });
    sendSuccess(res, { deleted: true });
  } catch (e) { next(e); }
});

router.post('/rules/:id/run', authorize('ANALYST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runRule(req.params.id, { id: req.user!.id, role: req.user!.role });
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ruleId } = req.query as { ruleId?: string };
    const logs = await getAutomationLogs({ id: req.user!.id, role: req.user!.role }, ruleId);
    sendSuccess(res, logs);
  } catch (e) { next(e); }
});

export { router as automationRouter };
