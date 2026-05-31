import type { Request, Response, NextFunction } from 'express';
import * as service from './tenants.service';
import { sendPaginated, sendSuccess } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, search, isActive } = req.query as Record<string, string>;
    const { tenants, total } = await service.getTenants({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search: search || undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    sendPaginated(res, tenants, total, Number(page) || 1, Number(limit) || 20);
  } catch (err) { next(err); }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getTenantById(req.params.id));
  } catch (err) { next(err); }
}
