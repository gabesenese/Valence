-- Migration 20260611220222 intended to replace the global lease_number unique
-- with a (lease_number, property_id) compound, but ran:
--   ALTER TABLE "leases" DROP CONSTRAINT IF EXISTS "leases_lease_number_key";
-- The init migration created that object with CREATE UNIQUE INDEX, not ADD
-- CONSTRAINT. In Postgres a plain unique index is not a constraint, so
-- DROP CONSTRAINT IF EXISTS was a silent no-op and the global unique index
-- survived alongside the new compound one. The lingering global index rejects
-- any imported lease whose number already exists under ANY owner/property,
-- so lease imports silently skipped every row (0 created).
DROP INDEX IF EXISTS "leases_lease_number_key";
