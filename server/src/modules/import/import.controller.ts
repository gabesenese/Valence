import type { Request, Response, NextFunction } from 'express';
import { importProperties, importTenants, importLeases, importExpenses, type ColumnMap, type FieldDefaults } from './import.service';
import { getImportMapping, saveImportMapping, type ImportMappingType } from './import-mapping.service';
import { analyzeImportHealth } from './import-intelligence.service';
import { logAudit } from '../audit/audit.service';
import { trackEvent } from '../analytics/funnel.service';
import { createBackup, attachImportCreatedIds, undoImport } from '../backup/backup.service';
import { sendSuccess } from '../../utils/response';
import { NotFoundError, ValidationError } from '../../utils/errors';
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

async function finishImport(
  userId: string,
  backupId: string,
  entity: string,
  result: Awaited<ReturnType<typeof importProperties>>,
  columnMap: ColumnMap | undefined,
  defaults: FieldDefaults | undefined,
  mappingType: ImportMappingType,
) {
  void attachImportCreatedIds(backupId, userId, result.createdIds).catch(() => {});
  if (columnMap && Object.keys(columnMap).length) {
    void saveImportMapping(userId, mappingType, columnMap, defaults).catch(() => {});
  }
  void logAudit({ userId, action: 'IMPORT', entity, meta: { created: result.created, skipped: result.skipped, errors: result.errors.length } });
  if (result.created + result.updated > 0) void trackEvent('data_imported', userId, { source: 'csv', entity, count: result.created });
}

export async function importPropertiesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    // Must complete before the import mutates data, or the "pre-import"
    // snapshot can capture post-import state.
    const backup = await createBackup(req.user!.id, snapshotLabel('Properties'), 'import');
    const columnMap = readJson<ColumnMap>(req, 'columnMap');
    const defaults = readJson<FieldDefaults>(req, 'defaults');
    const result = await importProperties(req.file.buffer, getPlan(req), req.user!.id, columnMap, defaults);
    await finishImport(req.user!.id, backup.id, 'property', result, columnMap, defaults, 'properties');
    sendSuccess(res, { ...result, backupId: backup.id });
  } catch (err) { next(err); }
}

export async function importTenantsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    // Must complete before the import mutates data, or the "pre-import"
    // snapshot can capture post-import state.
    const backup = await createBackup(req.user!.id, snapshotLabel('Tenants'), 'import');
    const columnMap = readJson<ColumnMap>(req, 'columnMap');
    const defaults = readJson<FieldDefaults>(req, 'defaults');
    const result = await importTenants(req.file.buffer, req.user!.id, columnMap, defaults);
    await finishImport(req.user!.id, backup.id, 'tenant', result, columnMap, defaults, 'tenants');
    sendSuccess(res, { ...result, backupId: backup.id });
  } catch (err) { next(err); }
}

export async function importLeasesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    // Must complete before the import mutates data, or the "pre-import"
    // snapshot can capture post-import state.
    const backup = await createBackup(req.user!.id, snapshotLabel('Leases'), 'import');
    const columnMap = readJson<ColumnMap>(req, 'columnMap');
    const defaults = readJson<FieldDefaults>(req, 'defaults');
    const result = await importLeases(req.file.buffer, getPlan(req), req.user!.id, columnMap, defaults);
    await finishImport(req.user!.id, backup.id, 'lease', result, columnMap, defaults, 'leases');
    sendSuccess(res, { ...result, backupId: backup.id });
  } catch (err) { next(err); }
}

export async function importExpensesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No CSV file uploaded' }); return; }
    // Must complete before the import mutates data, or the "pre-import"
    // snapshot can capture post-import state.
    const backup = await createBackup(req.user!.id, snapshotLabel('Expenses'), 'import');
    const columnMap = readJson<ColumnMap>(req, 'columnMap');
    const defaults = readJson<FieldDefaults>(req, 'defaults');
    const result = await importExpenses(req.file.buffer, req.user!.id, columnMap, defaults);
    await finishImport(req.user!.id, backup.id, 'financialRecord', result, columnMap, defaults, 'expenses');
    sendSuccess(res, { ...result, backupId: backup.id });
  } catch (err) { next(err); }
}

export async function getMappingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = req.params.type as ImportMappingType;
    const mapping = await getImportMapping(req.user!.id, type);
    sendSuccess(res, mapping);
  } catch (err) { next(err); }
}

export async function getHealthHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await analyzeImportHealth(req.user!.id);
    sendSuccess(res, report);
  } catch (err) { next(err); }
}

export async function undoImportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await undoImport(req.params.backupId, req.user!.id);
    sendSuccess(res, result);
  } catch (err) {
    if (!(err instanceof Error)) { next(err); return; }
    if (/not found/i.test(err.message)) { next(new NotFoundError('Backup')); return; }
    next(new ValidationError(err.message));
  }
}
