/*
 * One-time reconciliation for tasks orphaned before property/lease-delete cascade existed.
 *
 * Soft-deletes any active task whose property or lease is already soft-deleted.
 * Going forward deleteProperty / deleteLease cascade this automatically.
 *
 * Safe by default: previews the count and writes NOTHING. Pass --apply to execute.
 * Intended to be run against the live (Neon) database.
 */
import { prisma } from '../infrastructure/database';

async function main() {
  const apply = process.argv.includes('--apply');
  const where = {
    deletedAt: null,
    OR: [{ property: { deletedAt: { not: null } } }, { lease: { deletedAt: { not: null } } }],
  };

  const count = await prisma.task.count({ where });
  if (!apply) {
    console.log(`[dry-run] ${count} orphaned task(s) under deleted properties/leases would be soft-deleted.`);
    console.log('Re-run with --apply to execute.');
    return;
  }

  const result = await prisma.task.updateMany({ where, data: { deletedAt: new Date() } });
  console.log(`✓ Reconciled ${result.count} orphaned task(s)`);
}

main()
  .catch((err) => { console.error('Reconcile failed:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
