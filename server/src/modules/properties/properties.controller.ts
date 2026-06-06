import type { Request, Response, NextFunction } from 'express';
import * as service from './properties.service';
import { enforcePropertyLimit } from '../plans/plans.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import type { Plan } from '@prisma/client';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { properties, total } = await service.getProperties(req.query as never);
    sendPaginated(res, properties, total, Number(req.query.page) || 1, Number(req.query.limit) || 20);
  } catch (err) { next(err); }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getPropertyById(req.params.id));
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = ((req.user as { plan?: Plan })?.plan ?? 'ESSENTIALS') as Plan;
    await enforcePropertyLimit(plan);
    sendSuccess(res, await service.createProperty(req.body), 201);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.updateProperty(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deleteProperty(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}

export async function summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getPropertySummary());
  } catch (err) { next(err); }
}
