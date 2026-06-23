import type { Request, Response, NextFunction } from 'express';
import * as service from './changes.service';
import { sendSuccess } from '../../utils/response';

export async function since(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getChangesSince(req.user!.id));
  } catch (err) { next(err); }
}

export async function seen(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.markChangesSeen(req.user!.id, (req.body?.asOf as string | undefined) ?? undefined);
    sendSuccess(res, { ok: true });
  } catch (err) { next(err); }
}
