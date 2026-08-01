-- Store tenant credit scores encrypted at rest. The column becomes text to hold
-- AES-256-GCM ciphertext (prefixed `enc:v1:`). Existing integer values are
-- preserved as their decimal string here and encrypted in place by the
-- db:backfill-pii script; reads pass any remaining plaintext through untouched.
ALTER TABLE "tenants" ALTER COLUMN "credit_score" TYPE TEXT USING "credit_score"::text;
