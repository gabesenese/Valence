-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('REQUESTED', 'CONNECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'REQUESTED',
    "config" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integrations_owner_id_idx" ON "integrations"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_owner_id_provider_key" ON "integrations"("owner_id", "provider");

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
