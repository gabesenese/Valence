-- Enforce one active property code per owner. Backstops the app-level check
-- against concurrent-create races: a duplicate now fails with a unique
-- violation (P2002) instead of both inserts succeeding (issue #133).
-- Partial (WHERE deleted_at IS NULL) so soft-deleted codes can still be reused
-- and restore-from-trash isn't blocked by historical rows. Prisma cannot express
-- partial unique indexes in schema.prisma, so this lives as raw SQL.
CREATE UNIQUE INDEX "properties_owner_id_code_active_key"
  ON "properties" ("owner_id", "code")
  WHERE "deleted_at" IS NULL;
