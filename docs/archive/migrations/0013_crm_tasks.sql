-- migration: 0013_crm_tasks.sql
-- Creates the crm_task table which was added to the schema but never migrated.

-- 1. Create enums (idempotent)
DO $$ BEGIN
    CREATE TYPE crm_task_status AS ENUM ('Pending', 'In Progress', 'Completed', 'Canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crm_task_type AS ENUM ('Call', 'Email', 'Meeting', 'To-do');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crm_task_priority AS ENUM ('Low', 'Medium', 'High');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the crm_task table
CREATE TABLE IF NOT EXISTS "crm_task" (
    "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "leadId"      TEXT NOT NULL REFERENCES "lead"("id") ON DELETE CASCADE,
    "assignedTo"  TEXT REFERENCES "user"("id") ON DELETE SET NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "task_type"   crm_task_type NOT NULL DEFAULT 'To-do',
    "status"      crm_task_status NOT NULL DEFAULT 'Pending',
    "priority"    crm_task_priority NOT NULL DEFAULT 'Medium',
    "due_date"    TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "idx_crm_task_lead" ON "crm_task" ("leadId");
CREATE INDEX IF NOT EXISTS "idx_crm_task_assignee_status" ON "crm_task" ("assignedTo", "status");
CREATE INDEX IF NOT EXISTS "idx_crm_task_due_status" ON "crm_task" ("due_date", "status");
