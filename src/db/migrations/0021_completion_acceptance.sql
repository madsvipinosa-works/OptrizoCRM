-- 0021: client acceptance at project completion (steps 30-31, docs/proposals/client-acceptance-plan.md).
-- Idempotent. Hand-applied like 0010-0020. Run before deploying the code that reads these columns.

BEGIN;

ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS acceptance_requested_at timestamptz;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS accepted_by text REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS acceptance_assumed boolean NOT NULL DEFAULT false;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS acceptance_assumed_reason text;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS fixes_requested_at timestamptz;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS fixes_comment text;

COMMIT;
