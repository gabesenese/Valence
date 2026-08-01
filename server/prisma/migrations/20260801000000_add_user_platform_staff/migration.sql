-- Split platform staff from the SUPER_ADMIN role. `is_platform_staff` gates the
-- global /admin surface and the MRR exclusion, decoupled from a tenant's owner
-- role. This is a tenancy boundary: only Valence staff carry it, and it is the
-- one thing that legitimately reaches across organizations.

ALTER TABLE "users" ADD COLUMN "is_platform_staff" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing SUPER_ADMIN account is platform staff. This is safe
-- because SUPER_ADMIN is only granted at registration to the platform owner;
-- org owners promoted later via transfer-ownership keep the SUPER_ADMIN role
-- but are never auto-granted platform-staff access.
UPDATE "users" SET "is_platform_staff" = true WHERE "role" = 'SUPER_ADMIN';
