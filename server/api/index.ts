import { app } from '../src/app';
import { connectDatabase } from '../src/infrastructure/database';
import { prisma } from '../src/infrastructure/database';
import { logger } from '../src/utils/logger';

let initialized = false;

// Fast-path check: only run DDL if the deleted_at column is genuinely missing.
// This runs on every cold start, so the check must be cheap.
async function ensureSchema() {
  const [row] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'properties' AND column_name = 'deleted_at'
    ) AS exists
  `;
  if (row?.exists) return; // already migrated — skip everything

  logger.info('Running startup schema patch (deleted_at columns missing)');

  const ddl = [
    'ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)',
    'ALTER TABLE "tenants"    ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)',
    'ALTER TABLE "leases"     ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)',
    'CREATE INDEX IF NOT EXISTS "properties_deleted_at_idx" ON "properties"("deleted_at")',
    'CREATE INDEX IF NOT EXISTS "tenants_deleted_at_idx"    ON "tenants"("deleted_at")',
    'CREATE INDEX IF NOT EXISTS "leases_deleted_at_idx"     ON "leases"("deleted_at")',
    'CREATE TABLE IF NOT EXISTS "backups" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "label" TEXT NOT NULL, "trigger" TEXT NOT NULL DEFAULT \'manual\', "size_bytes" INTEGER NOT NULL DEFAULT 0, "snapshot" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "backups_pkey" PRIMARY KEY ("id"))',
    'CREATE INDEX  IF NOT EXISTS "backups_user_id_created_at_idx" ON "backups"("user_id", "created_at")',
  ];

  for (const sql of ddl) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      // "already exists" errors are expected and harmless
      if (!msg.includes('already exists') && !msg.includes('duplicate')) {
        logger.error('Startup schema patch failed', { sql, error: msg });
        throw err;
      }
    }
  }

  // FK constraint is separate — always expected to fail on re-runs, so catch quietly
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "backups" ADD CONSTRAINT "backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
  } catch { /* constraint already exists */ }

  logger.info('Startup schema patch complete');
}

/*
 * Drift repair: an early migration replaced the global lease_number unique with a
 * (lease_number, property_id) compound, but used DROP CONSTRAINT on an object
 * created via CREATE UNIQUE INDEX — a silent no-op — so the global index lingered
 * and blocked any lease import whose number already existed under another owner.
 * The prod build only runs `prisma generate`, so this self-heals on cold start:
 * ensure the compound exists, then drop the stale global index. Idempotent, and
 * the cheap existence check makes it a no-op once repaired.
 */
async function ensureAlertEmailOptIn() {
  try {
    const [row] = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'alert_email_opt_in'
      ) AS exists
    `;
    if (row?.exists) return;
    logger.info('Adding alert_email_opt_in column to users');
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "users" ADD COLUMN "alert_email_opt_in" BOOLEAN NOT NULL DEFAULT false'
    );
    logger.info('alert_email_opt_in column added');
  } catch (err) {
    logger.error('Failed to add alert_email_opt_in column', { error: (err as Error).message });
  }
}

async function ensureLeaseNumberIndex() {
  try {
    const [row] = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'leases' AND indexname = 'leases_lease_number_key'
      ) AS exists
    `;
    if (!row?.exists) return;

    logger.info('Repairing lease_number uniqueness (dropping stale global index)');
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "leases_lease_number_property_id_key" ON "leases"("lease_number","property_id")'
    );
    await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "leases_lease_number_key"');
    logger.info('lease_number uniqueness repaired');
  } catch (err) {
    logger.error('Failed to repair lease_number index', { error: (err as Error).message });
  }
}

export default async function handler(req: any, res: any) {
  if (!initialized) {
    await connectDatabase();
    await ensureSchema();
    await ensureLeaseNumberIndex();
    await ensureAlertEmailOptIn();
    initialized = true;
  }
  return app(req, res);
}
