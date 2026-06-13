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

export default async function handler(req: any, res: any) {
  if (!initialized) {
    await connectDatabase();
    await ensureSchema();
    initialized = true;
  }
  return app(req, res);
}
