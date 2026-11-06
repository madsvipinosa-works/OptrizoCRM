-- 0018: proposal exclusions and project name (Session: proposal drafting, STOP A1).
-- Idempotent. Hand-applied like 0010-0017 (the drizzle journal stops at 0009).
-- Column names are snake_case, matching the newer proposal columns (price_mode, total_price, needs_goals).

BEGIN;

ALTER TABLE proposal ADD COLUMN IF NOT EXISTS exclusions text;
ALTER TABLE proposal ADD COLUMN IF NOT EXISTS project_name text;

-- Verify (read-only):
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'proposal'
--     AND column_name IN ('exclusions', 'project_name');

COMMIT;
