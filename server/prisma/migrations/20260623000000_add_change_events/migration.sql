-- CreateEnum
CREATE TYPE "ChangeEventType" AS ENUM ('LEASE_RISK_UP', 'LEASE_RISK_DOWN', 'RENEWAL_WINDOW_OPENED', 'TASK_COMPLETED', 'REVENUE_RECONCILED', 'ALERT_CREATED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_changes_seen_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "change_events" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "type" "ChangeEventType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "amount" DECIMAL(15,2),
    "severity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "change_events_owner_user_id_created_at_idx" ON "change_events"("owner_user_id", "created_at");
