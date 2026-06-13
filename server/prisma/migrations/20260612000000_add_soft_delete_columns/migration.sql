-- Add soft-delete support: deleted_at column + index on properties, tenants, leases

ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "tenants"    ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "leases"     ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "properties_deleted_at_idx" ON "properties"("deleted_at");
CREATE INDEX IF NOT EXISTS "tenants_deleted_at_idx"    ON "tenants"("deleted_at");
CREATE INDEX IF NOT EXISTS "leases_deleted_at_idx"     ON "leases"("deleted_at");
