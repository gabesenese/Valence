import type { Request, Response, NextFunction } from 'express';
import { buildDailyBrief } from './brief.service';
import { sendSuccess } from '../../utils/response';

export async function today(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await buildDailyBrief(req.user!.id));
  } catch (err) { next(err); }
}
