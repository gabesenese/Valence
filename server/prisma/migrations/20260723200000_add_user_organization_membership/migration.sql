-- Add organization membership to users. Until now users had no link to an
-- organization: the team list could not be scoped, so SUPER_ADMIN viewers
-- saw every user on the platform (including demo accounts).

ALTER TABLE "users" ADD COLUMN "organization_id" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- Backfill 1: owners belong to the organization they own.
UPDATE "users" u
SET "organization_id" = o."id"
FROM "organization" o
WHERE o."owner_id" = u."id";

-- Backfill 2: members who joined via an accepted invite belong to their
-- inviter's organization. Runs after backfill 1 so inviters already have
-- their organization_id set. Demo accounts and unaffiliated users stay NULL.
UPDATE "users" u
SET "organization_id" = inviter."organization_id"
FROM "invites" i
JOIN "users" inviter ON inviter."id" = i."invited_by_id"
WHERE i."email" = u."email"
  AND i."accepted_at" IS NOT NULL
  AND u."organization_id" IS NULL
  AND inviter."organization_id" IS NOT NULL
  AND u."is_demo" = false;
