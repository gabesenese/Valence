import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';
import { getTasksForItem, createTask, updateTaskStatus, deleteTask, type TaskStatus } from './tasks.service';

const router = Router();
router.use(authenticate);

// GET /tasks?alertId=&leaseId=&propertyId=
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alertId, leaseId, propertyId } = req.query as Record<string, string | undefined>;
    const tasks = await getTasksForItem({
      ...(alertId    ? { alertId }    : {}),
      ...(leaseId    ? { leaseId }    : {}),
      ...(propertyId ? { propertyId } : {}),
    });
    sendSuccess(res, tasks);
  } catch (e) { next(e); }
});

// POST /tasks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
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

// PATCH /tasks/:id/status
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
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

// DELETE /tasks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteTask(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (e) { next(e); }
});

export { router as tasksRouter };
