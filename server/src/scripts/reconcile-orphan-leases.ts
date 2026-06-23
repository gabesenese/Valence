/*
 * One-time reconciliation for leases orphaned before property-delete cascade existed.
 *
 * Soft-deletes any lease whose property is already soft-deleted. Going forward
 * deleteProperty cascades this automatically; this script repairs historical data.
 * Idempotent — re-running it is a no-op once everything is reconciled.
 */
import { prisma } from '../infrastructure/database';

async function main() {
  const result = await prisma.lease.updateMany({
    where: { deletedAt: null, property: { deletedAt: { not: null } } },
    data: { deletedAt: new Date() },
  });
  console.log(`✓ Reconciled ${result.count} orphaned lease(s) under deleted properties`);
}

main()
  .catch((err) => { console.error('Reconcile failed:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
