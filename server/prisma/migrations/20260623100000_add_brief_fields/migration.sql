-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_brief_sent_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "daily_brief_opt_out" BOOLEAN NOT NULL DEFAULT false;
