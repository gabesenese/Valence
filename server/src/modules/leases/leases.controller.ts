import type { Request, Response, NextFunction } from 'express';
import * as service from './leases.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { leases, total } = await service.getLeases(req.query as never);
    sendPaginated(res, leases, total, Number(req.query.page) || 1, Number(req.query.limit) || 20);
  } catch (err) { next(err); }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getLeaseById(req.params.id));
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
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

export async function stats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getLeaseStats());
  } catch (err) { next(err); }
}
