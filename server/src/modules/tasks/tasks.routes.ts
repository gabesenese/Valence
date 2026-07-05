import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOwner } from '../../middleware/ownership';
import { assertPropertyOwner, assertLeaseOwner, assertAlertOwner } from '../../utils/ownership';
import { sendSuccess } from '../../utils/response';
import {
  getTasksForItem,
  listAllTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  type TaskStatus,
} from './tasks.service';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alertId, leaseId, propertyId, status, assigneeUserId, unassigned } =
      req.query as Record<string, string | undefined>;

    if (alertId || (leaseId && !status && !assigneeUserId) || (propertyId && !status && !assigneeUserId)) {
      const tasks = await getTasksForItem({
        ...(alertId    ? { alertId }    : {}),
        ...(leaseId    ? { leaseId }    : {}),
        ...(propertyId ? { propertyId } : {}),
      }, req.user!.id);
      return sendSuccess(res, tasks);
    }

    const tasks = await listAllTasks({
      status: status as TaskStatus | undefined,
      assigneeUserId,
      propertyId,
      leaseId,
      unassigned: unassigned === 'true',
    }, req.user!.id);
    return sendSuccess(res, tasks);
  } catch (e) { next(e); }
});

router.post('/', authorize('ANALYST'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, alertId, leaseId, propertyId, assigneeUserId, dueAt } = req.body as {
      title: string;
      description?: string;
      alertId?: string;
      leaseId?: string;
      propertyId?: string;
      assigneeUserId?: string;
      dueAt?: string;
    };

    if (!title?.trim()) {
      res.status(400).json({ success: false, message: 'title is required' });
      return;
    }

    if (propertyId) await assertPropertyOwner(propertyId, req.user!.id);
    if (leaseId)    await assertLeaseOwner(leaseId, req.user!.id);
    if (alertId)    await assertAlertOwner(alertId, req.user!.id);

    const task = await createTask({
      title: title.trim(),
      description: description?.trim(),
      alertId,
      leaseId,
      propertyId,
      assigneeUserId,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      createdById: req.user!.id,
    });

    res.status(201).json({ success: true, data: task });
  } catch (e) { next(e); }
});

router.patch('/:id', authorize('ANALYST'), requireOwner('task'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, assigneeUserId, dueAt } = req.body as {
      title?: string;
      description?: string;
      assigneeUserId?: string | null;
      dueAt?: string | null;
    };

    const task = await updateTask(req.params.id, {
      title,
      description,
      assigneeUserId,
      dueAt: dueAt === null ? null : dueAt ? new Date(dueAt) : undefined,
    });
    sendSuccess(res, task);
  } catch (e) { next(e); }
});

router.patch('/:id/status', authorize('ANALYST'), requireOwner('task'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, completionNote } = req.body as {
      status: TaskStatus;
      completionNote?: string;
    };

    const valid: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!valid.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    const task = await updateTaskStatus(req.params.id, status, req.user!.id, completionNote);
    sendSuccess(res, task);
  } catch (e) { next(e); }
});

router.delete('/:id', authorize('ADMIN'), requireOwner('task'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteTask(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (e) { next(e); }
});

export { router as tasksRouter };
