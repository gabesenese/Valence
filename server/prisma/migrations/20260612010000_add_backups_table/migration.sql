-- Add backups table for point-in-time data recovery

CREATE TABLE "backups" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "trigger"    TEXT NOT NULL DEFAULT 'manual',
  "size_bytes" INTEGER NOT NULL DEFAULT 0,
  "snapshot"   JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backups_user_id_created_at_idx" ON "backups"("user_id", "created_at");

ALTER TABLE "backups" ADD CONSTRAINT "backups_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
