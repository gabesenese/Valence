/*
 * One-time reconciliation for alerts orphaned before property/lease-delete cascade existed.
 *
 * Dismisses any open/in-progress/acknowledged alert whose property or lease is
 * already soft-deleted. Going forward deleteProperty / deleteLease cascade this.
 *
 * Safe by default: previews the count and writes NOTHING. Pass --apply to execute.
 * Intended to be run against the live (Neon) database.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/database';

async function main() {
  const apply = process.argv.includes('--apply');
  const where: Prisma.AlertWhereInput = {
    status: { in: ['OPEN', 'IN_PROGRESS', 'ACKNOWLEDGED'] },
    OR: [{ property: { deletedAt: { not: null } } }, { lease: { deletedAt: { not: null } } }],
  };

  const count = await prisma.alert.count({ where });
  if (!apply) {
    console.log(`[dry-run] ${count} orphaned alert(s) under deleted properties/leases would be dismissed.`);
    console.log('Re-run with --apply to execute.');
    return;
  }

  const result = await prisma.alert.updateMany({ where, data: { status: 'DISMISSED', dismissedAt: new Date() } });
  console.log(`✓ Dismissed ${result.count} orphaned alert(s)`);
}

main()
  .catch((err) => { console.error('Reconcile failed:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
