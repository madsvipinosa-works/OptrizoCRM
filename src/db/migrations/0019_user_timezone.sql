-- 0019: user timezone (PR #24, client timezone in the portal and emails). schema.ts added
-- users.timezone without a migration, so every query that loads a full user row failed with
-- `column "timezone" does not exist` (opening a proposal, among others).
-- Idempotent. Hand-applied like 0010-0018 (the drizzle journal stops at 0009).

BEGIN;

-- IANA name from the client's device, e.g. 'Asia/Manila'. Null until the portal records it.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS timezone text;

-- Verify (read-only):
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'timezone';

COMMIT;
