-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('ESSENTIALS', 'PROFESSIONAL', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('AI_ANALYSIS', 'CONTRACT_PROCESSING', 'IMPACT_SIMULATION');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'ESSENTIALS';

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "UsageType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_records_user_id_type_period_start_idx" ON "usage_records"("user_id", "type", "period_start");

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
