-- 0024: where a meeting happens (video/meeting link, or venue/address). Optional for phone meetings.
-- Idempotent. Hand-applied like 0010-0023. Run before deploying the code that reads this column.

BEGIN;

ALTER TABLE meeting ADD COLUMN IF NOT EXISTS location text;

COMMIT;
