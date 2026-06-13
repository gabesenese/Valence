import type { Request, Response, NextFunction } from 'express';
import { createBackup, listBackups, getBackup, deleteBackup, restoreBackup, MAX_MANUAL_BACKUPS } from './backup.service';
import { prisma } from '../../infrastructure/database';
import { sendSuccess } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const backups = await listBackups(req.user!.id);
    sendSuccess(res, backups);
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const label = (req.body.label as string | undefined)?.trim() || `Manual — ${new Date().toLocaleDateString('en-CA')}`;

    const manualCount = await prisma.backup.count({ where: { userId, trigger: 'manual' } });
    if (manualCount >= MAX_MANUAL_BACKUPS) {
      res.status(400).json({ success: false, message: `Maximum of ${MAX_MANUAL_BACKUPS} manual backups reached. Delete an existing one first.` });
      return;
    }

    const backup = await createBackup(userId, label, 'manual');
    sendSuccess(res, backup, 201);
  } catch (err) { next(err); }
}

export async function restore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await restoreBackup(req.params.id, req.user!.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function download(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const backup = await getBackup(req.params.id, req.user!.id);
    const filename = `valence-backup-${backup.createdAt.toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup.snapshot, null, 2));
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteBackup(req.params.id, req.user!.id);
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}
