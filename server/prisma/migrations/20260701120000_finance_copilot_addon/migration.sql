-- AlterTable: AI Copilot add-on entitlement
ALTER TABLE "users" ADD COLUMN "addons" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: AI usage / cost logging
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
