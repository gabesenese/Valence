-- Add lifecycle tracking fields to alerts
ALTER TABLE "alerts" ADD COLUMN "acknowledged_at"   TIMESTAMP(3);
ALTER TABLE "alerts" ADD COLUMN "acknowledged_by_id" TEXT;
ALTER TABLE "alerts" ADD COLUMN "dismissed_at"       TIMESTAMP(3);
ALTER TABLE "alerts" ADD COLUMN "dismissed_by_id"    TEXT;

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_id_fkey"
  FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_dismissed_by_id_fkey"
  FOREIGN KEY ("dismissed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
