-- AlterTable: scope organization settings to an owner (per-tenant)
ALTER TABLE "organization" ADD COLUMN "owner_id" TEXT;

-- CreateIndex: enforce one organization row per owner
CREATE UNIQUE INDEX "organization_owner_id_key" ON "organization"("owner_id");
