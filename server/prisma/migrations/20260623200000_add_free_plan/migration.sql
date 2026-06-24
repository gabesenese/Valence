-- Add FREE tier as the new default plan for signups.
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'FREE' BEFORE 'ESSENTIALS';

-- New signups default to FREE instead of the paid ESSENTIALS tier.
ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'FREE';
