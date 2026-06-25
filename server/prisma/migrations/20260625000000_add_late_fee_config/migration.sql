-- CreateEnum
CREATE TYPE "LateFeeType" AS ENUM ('NONE', 'FLAT', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "leases" ADD COLUMN "late_fee_type" "LateFeeType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "leases" ADD COLUMN "late_fee_flat" DECIMAL(12,2);
ALTER TABLE "leases" ADD COLUMN "late_fee_percent" DECIMAL(5,2);
ALTER TABLE "leases" ADD COLUMN "late_fee_grace_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leases" ADD COLUMN "late_fee_interest_pct" DECIMAL(5,2);
