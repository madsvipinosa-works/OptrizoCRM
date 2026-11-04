-- Verification query to run in Supabase SQL Editor to inspect columns of all audited tables:
/*
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'document',
    'project_feedback',
    'payment',
    'agency_project',
    'user',
    'task',
    'sprint',
    'audit_log',
    'project_team_member',
    'verificationToken'
  )
ORDER BY table_name, ordinal_position;
*/

BEGIN;

-- Fix schema drift on "document":
-- In src/db/schema.ts, fileName is defined as text("file_name").notNull() without a default,
-- and fileSize is integer("file_size") (nullable).
-- Because the live "document" table may already contain rows, file_name is added as nullable
-- to prevent NOT NULL constraint violation on existing records.
ALTER TABLE document ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE document ADD COLUMN IF NOT EXISTS file_size integer;

-- Migration 0013 defines "type" with CHECK (type IN ('handover')) and src/db/schema.ts
-- does not map it, so inserts must get a default.
ALTER TABLE document ALTER COLUMN type SET DEFAULT 'handover';

COMMIT;

