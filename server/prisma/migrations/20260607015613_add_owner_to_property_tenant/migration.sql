-- DropIndex
DROP INDEX "properties_code_key";

-- DropIndex
DROP INDEX "tenants_email_key";

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "owner_id" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "owner_id" TEXT;

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- CreateIndex
CREATE INDEX "tenants_owner_id_idx" ON "tenants"("owner_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
