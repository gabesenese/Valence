-- Idempotent: safe to apply manually to a drifted prod DB (see prod-ops notes).
CREATE TABLE IF NOT EXISTS "sync_runs" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "summary" JSONB,
    "error" TEXT,
    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sync_runs_owner_id_provider_started_at_idx" ON "sync_runs"("owner_id", "provider", "started_at");

CREATE TABLE IF NOT EXISTS "external_refs" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_refs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "external_refs_owner_id_provider_entity_type_external_id_key" ON "external_refs"("owner_id", "provider", "entity_type", "external_id");
CREATE INDEX IF NOT EXISTS "external_refs_owner_id_provider_entity_type_idx" ON "external_refs"("owner_id", "provider", "entity_type");
