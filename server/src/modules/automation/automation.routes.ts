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

// GET /automation/rules
router.get('/rules', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await getRules();
    sendSuccess(res, rules);
  } catch (e) { next(e); }
});

// POST /automation/rules (ADMIN+)
router.post('/rules', authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
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

// PATCH /automation/rules/:id (ADMIN+)
router.patch('/rules/:id', authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await updateRule(req.params.id, req.body);
    sendSuccess(res, rule);
  } catch (e) { next(e); }
});

// DELETE /automation/rules/:id (ADMIN+)
router.delete('/rules/:id', authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteRule(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (e) { next(e); }
});

// POST /automation/rules/:id/run — manual trigger (ADMIN+)
router.post('/rules/:id/run', authorize('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runRule(req.params.id);
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

// GET /automation/logs
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ruleId } = req.query as { ruleId?: string };
    const logs = await getAutomationLogs(ruleId);
    sendSuccess(res, logs);
  } catch (e) { next(e); }
});

export { router as automationRouter };
