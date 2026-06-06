import type { Request, Response, NextFunction } from 'express';
import * as service from './leases.service';
import { enforceLeaseLimit } from '../plans/plans.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import type { Plan } from '@prisma/client';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { leases, total } = await service.getLeases(req.query as never);
    sendPaginated(res, leases, total, Number(req.query.page) || 1, Number(req.query.limit) || 20);
  } catch (err) { next(err); }
}

export async function priorityQueue(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getPriorityQueue());
  } catch (err) { next(err); }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getLeaseById(req.params.id));
  } catch (err) { next(err); }
}

export async function preview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getLeasePreview(req.params.id));
  } catch (err) { next(err); }
}

export async function activity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getLeaseActivity(req.params.id));
  } catch (err) { next(err); }
}

export async function notes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getLeaseNotes(req.params.id));
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = ((req.user as { plan?: Plan })?.plan ?? 'ESSENTIALS') as Plan;
    await enforceLeaseLimit(plan);
    sendSuccess(res, await service.createLease(req.body), 201);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.updateLease(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deleteLease(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}

export async function kanban(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getKanban());
  } catch (err) { next(err); }
}

export async function stats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getLeaseStats());
  } catch (err) { next(err); }
}

export async function startRenewal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    sendSuccess(res, await service.startRenewal(req.params.id, userId));
  } catch (err) { next(err); }
}

export async function setRenewalDate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { renewalDate } = req.body as { renewalDate: string };
    sendSuccess(res, await service.setRenewalDateAction(req.params.id, req.user!.id, renewalDate));
  } catch (err) { next(err); }
}

export async function assignOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ownerUserId } = req.body as { ownerUserId: string };
    sendSuccess(res, await service.assignOwner(req.params.id, req.user!.id, ownerUserId));
  } catch (err) { next(err); }
}

export async function markContacted(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.markContacted(req.params.id, req.user!.id));
  } catch (err) { next(err); }
}

export async function snooze(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days = Number(req.body?.days) || 7;
    sendSuccess(res, await service.snoozeLease(req.params.id, req.user!.id, days));
  } catch (err) { next(err); }
}

export async function clearRenewalDate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.clearRenewalDate(req.params.id, req.user!.id));
  } catch (err) { next(err); }
}

export async function advanceStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { stage } = req.body as { stage: string };
    sendSuccess(res, await service.advanceRenewalStage(req.params.id, req.user!.id, stage as never));
  } catch (err) { next(err); }
}

export async function addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.addLeaseNote(req.params.id, req.user!.id, req.body), 201);
  } catch (err) { next(err); }
}

export async function editNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = req.body as { body: string };
    sendSuccess(res, await service.editLeaseNote(req.params.id, req.params.noteId, body));
  } catch (err) { next(err); }
}

export async function deleteNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.deleteLeaseNote(req.params.id, req.params.noteId, req.user!.id));
  } catch (err) { next(err); }
}

export async function bulk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.bulkAction(req.body, req.user!.id);
    if ('csv' in result) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="leases.csv"');
      res.send(result.csv);
      return;
    }
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
