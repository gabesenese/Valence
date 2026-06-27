-- Idempotent: safe to apply manually to a drifted prod DB (see prod-ops notes).
CREATE TABLE IF NOT EXISTS "integration_mappings" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_value" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "integration_mappings_owner_id_provider_source_type_source_value_key" ON "integration_mappings"("owner_id", "provider", "source_type", "source_value");
CREATE INDEX IF NOT EXISTS "integration_mappings_owner_id_provider_idx" ON "integration_mappings"("owner_id", "provider");

CREATE TABLE IF NOT EXISTS "pending_sync_records" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source_tags" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pending_sync_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pending_sync_records_owner_id_provider_external_id_key" ON "pending_sync_records"("owner_id", "provider", "external_id");
CREATE INDEX IF NOT EXISTS "pending_sync_records_owner_id_provider_idx" ON "pending_sync_records"("owner_id", "provider");
