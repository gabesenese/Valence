import type { Request, Response, NextFunction } from 'express';
import { importProperties, importTenants, importLeases } from './import.service';
import { sendSuccess } from '../../utils/response';
import type { Plan } from '@prisma/client';

function getPlan(req: Request): Plan {
  return (req.user?.plan ?? 'ESSENTIALS') as Plan;
}

export async function importPropertiesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    const result = await importProperties(req.file.buffer, getPlan(req));
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function importTenantsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    const result = await importTenants(req.file.buffer);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function importLeasesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    const result = await importLeases(req.file.buffer, getPlan(req));
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
