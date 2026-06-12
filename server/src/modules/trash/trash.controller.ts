import type { Request, Response, NextFunction } from 'express';
import { listTrash, restoreItem, permanentlyDelete, emptyTrash } from './trash.service';
import { sendSuccess } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listTrash(req.user!.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function restore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, id } = req.params as { type: 'property' | 'lease' | 'tenant'; id: string };
    const result = await restoreItem(type, id, req.user!.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function purge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, id } = req.params as { type: 'property' | 'lease' | 'tenant'; id: string };
    await permanentlyDelete(type, id, req.user!.id);
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}

export async function empty(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await emptyTrash(req.user!.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
