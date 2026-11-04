BEGIN;

-- Session 10: Super Admin accounts - lockout columns on "user"
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS failed_logins integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Backfill status and is_active consistency
UPDATE "user" SET status = 'deactivated' WHERE is_active = false AND status = 'active';
UPDATE "user" SET is_active = false WHERE status = 'deactivated' AND is_active = true;

-- Optional index on lower(email), only if query 5 shows none
-- CREATE INDEX IF NOT EXISTS idx_user_lower_email ON "user" (lower(email));

COMMIT;

