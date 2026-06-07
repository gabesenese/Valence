import type { Request, Response, NextFunction } from 'express';
import * as service from './tenants.service';
import { logAudit } from '../audit/audit.service';
import { sendPaginated, sendSuccess } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, search, isActive } = req.query as Record<string, string>;
    const { tenants, total } = await service.getTenants({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search: search || undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    }, req.user!.id);
    sendPaginated(res, tenants, total, Number(page) || 1, Number(limit) || 20);
  } catch (err) { next(err); }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getTenantById(req.params.id));
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.createTenant(req.body, req.user!.id);
    void logAudit({ userId: req.user?.id, action: 'CREATE', entity: 'tenant', entityId: result.id, entityName: result.name });
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.updateTenant(req.params.id, req.body, req.user!.id);
    void logAudit({ userId: req.user?.id, action: 'UPDATE', entity: 'tenant', entityId: result.id, entityName: result.name, changes: req.body as Record<string, unknown> });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
