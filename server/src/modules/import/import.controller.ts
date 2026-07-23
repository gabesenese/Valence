import type { Request, Response, NextFunction } from 'express';
import { importProperties, importTenants, importLeases, importExpenses, type ColumnMap, type FieldDefaults } from './import.service';
import { logAudit } from '../audit/audit.service';
import { trackEvent } from '../analytics/funnel.service';
import { createBackup } from '../backup/backup.service';
import { sendSuccess } from '../../utils/response';
import type { Plan } from '@prisma/client';

function getPlan(req: Request): Plan {
  return (req.user?.plan ?? 'ESSENTIALS') as Plan;
}

function readJson<T>(req: Request, field: string): T | undefined {
  const raw = (req.body as Record<string, unknown>)?.[field];
  if (!raw) return undefined;
  try { return JSON.parse(raw as string) as T; } catch { return undefined; }
}

function snapshotLabel(entity: string): string {
  return `Pre-import: ${entity} — ${new Date().toLocaleDateString('en-CA')}`;
}

export async function importPropertiesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    // Must complete before the import mutates data, or the "pre-import"
    // snapshot can capture post-import state.
    await createBackup(req.user!.id, snapshotLabel('Properties'), 'import');
    const result = await importProperties(req.file.buffer, getPlan(req), req.user!.id, readJson<ColumnMap>(req, 'columnMap'), readJson<FieldDefaults>(req, 'defaults'));
    void logAudit({ userId: req.user?.id, action: 'IMPORT', entity: 'property', meta: { created: result.created, skipped: result.skipped, errors: result.errors.length } });
    if (result.created + result.updated > 0) void trackEvent('data_imported', req.user?.id, { source: 'csv', entity: 'property', count: result.created });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function importTenantsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    // Must complete before the import mutates data, or the "pre-import"
    // snapshot can capture post-import state.
    await createBackup(req.user!.id, snapshotLabel('Tenants'), 'import');
    const result = await importTenants(req.file.buffer, req.user!.id, readJson<ColumnMap>(req, 'columnMap'), readJson<FieldDefaults>(req, 'defaults'));
    void logAudit({ userId: req.user?.id, action: 'IMPORT', entity: 'tenant', meta: { created: result.created, skipped: result.skipped, errors: result.errors.length } });
    if (result.created + result.updated > 0) void trackEvent('data_imported', req.user?.id, { source: 'csv', entity: 'tenant', count: result.created });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function importLeasesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    // Must complete before the import mutates data, or the "pre-import"
    // snapshot can capture post-import state.
    await createBackup(req.user!.id, snapshotLabel('Leases'), 'import');
    const result = await importLeases(req.file.buffer, getPlan(req), req.user!.id, readJson<ColumnMap>(req, 'columnMap'), readJson<FieldDefaults>(req, 'defaults'));
    void logAudit({ userId: req.user?.id, action: 'IMPORT', entity: 'lease', meta: { created: result.created, skipped: result.skipped, errors: result.errors.length } });
    if (result.created + result.updated > 0) void trackEvent('data_imported', req.user?.id, { source: 'csv', entity: 'lease', count: result.created });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function importExpensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    // Must complete before the import mutates data, or the "pre-import"
    // snapshot can capture post-import state.
    await createBackup(req.user!.id, snapshotLabel('Expenses'), 'import');
    const result = await importExpenses(req.file.buffer, req.user!.id, readJson<ColumnMap>(req, 'columnMap'), readJson<FieldDefaults>(req, 'defaults'));
    void logAudit({ userId: req.user?.id, action: 'IMPORT', entity: 'financialRecord', meta: { created: result.created, skipped: result.skipped, errors: result.errors.length } });
    if (result.created + result.updated > 0) void trackEvent('data_imported', req.user?.id, { source: 'csv', entity: 'expense', count: result.created });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
