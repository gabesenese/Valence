-- CreateEnum
CREATE TYPE "RenewalStage" AS ENUM ('NOT_STARTED', 'CONTACTED', 'NEGOTIATING', 'DRAFT_SENT', 'SCHEDULED_RENEWAL', 'SIGNED');

-- AlterTable
ALTER TABLE "leases" ADD COLUMN     "last_contacted_at" TIMESTAMP(3),
ADD COLUMN     "owner_user_id" TEXT,
ADD COLUMN     "renewal_scheduled_at" TIMESTAMP(3),
ADD COLUMN     "renewal_stage" "RenewalStage" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "snoozed_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lease_activities" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lease_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lease_notes" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lease_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lease_activities_lease_id_idx" ON "lease_activities"("lease_id");

-- CreateIndex
CREATE INDEX "lease_activities_created_at_idx" ON "lease_activities"("created_at");

-- CreateIndex
CREATE INDEX "lease_notes_lease_id_idx" ON "lease_notes"("lease_id");

-- CreateIndex
CREATE INDEX "leases_owner_user_id_idx" ON "leases"("owner_user_id");

-- CreateIndex
CREATE INDEX "leases_renewal_stage_idx" ON "leases"("renewal_stage");

-- CreateIndex
CREATE INDEX "leases_snoozed_until_idx" ON "leases"("snoozed_until");

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_activities" ADD CONSTRAINT "lease_activities_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_activities" ADD CONSTRAINT "lease_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_notes" ADD CONSTRAINT "lease_notes_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_notes" ADD CONSTRAINT "lease_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
