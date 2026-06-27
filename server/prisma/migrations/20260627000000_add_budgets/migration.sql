-- Idempotent: safe to apply manually to a drifted prod DB (see prod-ops notes).
CREATE TABLE IF NOT EXISTS "budgets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "property_id" TEXT,
    "category" TEXT NOT NULL,
    "monthly_amount" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "budgets_owner_id_property_id_category_key" ON "budgets"("owner_id", "property_id", "category");
CREATE INDEX IF NOT EXISTS "budgets_owner_id_idx" ON "budgets"("owner_id");
