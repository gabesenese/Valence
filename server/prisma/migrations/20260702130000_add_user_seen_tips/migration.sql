-- Per-user dismissed contextual page tips (server-backed so guidance survives browser-data clears)
ALTER TABLE "users" ADD COLUMN "seen_tips" TEXT[] NOT NULL DEFAULT '{}';
