import { app } from '../src/app';
import { connectDatabase } from '../src/infrastructure/database';
import { prisma } from '../src/infrastructure/database';

let initialized = false;

async function ensureSchema() {
  const stmts = [
    'ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)',
    'ALTER TABLE "tenants"    ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)',
    'ALTER TABLE "leases"     ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)',
    'CREATE INDEX IF NOT EXISTS "properties_deleted_at_idx" ON "properties"("deleted_at")',
    'CREATE INDEX IF NOT EXISTS "tenants_deleted_at_idx"    ON "tenants"("deleted_at")',
    'CREATE INDEX IF NOT EXISTS "leases_deleted_at_idx"     ON "leases"("deleted_at")',
    'CREATE TABLE IF NOT EXISTS "backups" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "label" TEXT NOT NULL, "trigger" TEXT NOT NULL DEFAULT \'manual\', "size_bytes" INTEGER NOT NULL DEFAULT 0, "snapshot" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "backups_pkey" PRIMARY KEY ("id"))',
    'CREATE INDEX IF NOT EXISTS "backups_user_id_created_at_idx" ON "backups"("user_id", "created_at")',
    'ALTER TABLE "backups" ADD CONSTRAINT "backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE',
  ];
  for (const sql of stmts) {
    try { await prisma.$executeRawUnsafe(sql); } catch { /* already exists */ }
  }
}

export default async function handler(req: any, res: any) {
  if (!initialized) {
    await connectDatabase();
    await ensureSchema();
    initialized = true;
  }
  return app(req, res);
}
