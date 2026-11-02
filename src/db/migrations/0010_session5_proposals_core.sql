BEGIN;

-- Migration 0010: Session 5 Proposals Core
-- Hand-written idempotent migration for Supabase SQL Editor

-- 1. Item 1: assigned_pm_id on leads ("lead" table)
-- Note: No index on assigned_pm_id
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "assigned_pm_id" text REFERENCES "user"("id") ON DELETE SET NULL;

COMMIT;
