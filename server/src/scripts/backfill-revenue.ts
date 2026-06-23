/*
 * Revenue backfill — production / customer portfolios only.
 *
 * Generates the monthly revenue schedule for every existing lease. Safe to re-run:
 * it only replaces records it previously generated (referenceId prefixed "lease-rent:").
 *
 * Do NOT run against a seeded demo database. Seed revenue records carry no referenceId,
 * so the backfill cannot replace them — it would create a parallel generated set and
 * double-count revenue. Remove seed revenue first if backfilling a seeded database.
 */
import { prisma } from '../infrastructure/database';
import { backfillRevenueSchedules } from '../modules/finance/revenue-schedule.service';

async function main() {
  const { leasesProcessed, recordsCreated } = await backfillRevenueSchedules();
  console.log(`✓ Revenue backfill complete — ${recordsCreated} records across ${leasesProcessed} leases`);
}

main()
  .catch((err) => {
    console.error('Revenue backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
