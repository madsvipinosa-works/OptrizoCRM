-- 0020: milestones the PM adds to a proposal, beside the 5 defaults (decision 2026-11-08, user).
-- A default milestone keeps its name (requirements, design, development, uat_testing, handover);
-- an added one has no name and stores its own title, description and position.
-- Idempotent. Hand-applied like 0010-0019 (the drizzle journal stops at 0009).
-- Must be run before the code that reads these columns is deployed, or proposal pages fail.

BEGIN;

ALTER TABLE proposal_milestone ALTER COLUMN name DROP NOT NULL;
ALTER TABLE proposal_milestone ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE proposal_milestone ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE proposal_milestone ADD COLUMN IF NOT EXISTS sort_order integer;

-- The unique (proposal_id, name) index stays: Postgres treats NULL names as distinct,
-- so a proposal can have many added milestones but each default only once.

-- Verify (read-only):
--   SELECT column_name, is_nullable FROM information_schema.columns
--   WHERE table_name = 'proposal_milestone' AND column_name IN ('name', 'title', 'description', 'sort_order');

COMMIT;
