-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "AlertStatus" ADD VALUE 'DISMISSED';

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "assignee_user_id" TEXT,
ADD COLUMN     "resolution_note" TEXT;

-- CreateTable
CREATE TABLE "alert_activities" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_locks" (
    "id" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL,
    "locked_until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_activities_alert_id_idx" ON "alert_activities"("alert_id");

-- CreateIndex
CREATE INDEX "alert_activities_created_at_idx" ON "alert_activities"("created_at");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_activities" ADD CONSTRAINT "alert_activities_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_activities" ADD CONSTRAINT "alert_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
