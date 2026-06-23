/*
 * One-time reconciliation for leases orphaned before property-delete cascade existed.
 *
 * Soft-deletes any lease whose property is already soft-deleted. Going forward
 * deleteProperty cascades this automatically; this script repairs historical data.
 * Idempotent — re-running it is a no-op once everything is reconciled.
 *
 * Safe by default: previews the count and writes NOTHING. Pass --apply to execute.
 * Intended to be run against the live (Neon) database, so it must not mutate blindly.
 */
import { prisma } from '../infrastructure/database';

async function main() {
  const apply = process.argv.includes('--apply');
  const where = { deletedAt: null, property: { deletedAt: { not: null } } } as const;

  const count = await prisma.lease.count({ where });
  if (!apply) {
    console.log(`[dry-run] ${count} orphaned lease(s) under deleted properties would be soft-deleted.`);
    console.log('Re-run with --apply to execute.');
    return;
  }

  const result = await prisma.lease.updateMany({ where, data: { deletedAt: new Date() } });
  console.log(`✓ Reconciled ${result.count} orphaned lease(s) under deleted properties`);
}

main()
  .catch((err) => { console.error('Reconcile failed:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
