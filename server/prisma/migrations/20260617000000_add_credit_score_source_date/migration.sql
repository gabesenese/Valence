-- CreateEnum
CREATE TYPE "CreditScoreSource" AS ENUM ('MANUAL', 'EQUIFAX', 'TRANSUNION');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "credit_score_source" "CreditScoreSource",
ADD COLUMN     "credit_score_date" TIMESTAMP(3);
