import type { Request, Response, NextFunction } from 'express';
import * as service from './properties.service';
import { enforcePropertyLimit } from '../plans/plans.service';
import { logAudit } from '../audit/audit.service';
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
    const result = await service.createProperty(req.body);
    void logAudit({ userId: req.user?.id, action: 'CREATE', entity: 'property', entityId: result.id, entityName: result.name });
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.updateProperty(req.params.id, req.body);
    void logAudit({ userId: req.user?.id, action: 'UPDATE', entity: 'property', entityId: result.id, entityName: result.name, changes: req.body as Record<string, unknown> });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await service.getPropertyById(req.params.id);
    await service.deleteProperty(req.params.id);
    void logAudit({ userId: req.user?.id, action: 'DELETE', entity: 'property', entityId: req.params.id, entityName: existing.name });
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}

export async function summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getPropertySummary());
  } catch (err) { next(err); }
}
