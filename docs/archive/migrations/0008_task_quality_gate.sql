-- migration: 0008_task_quality_gate.sql

-- 1. Must run as standalone query outside transaction blocks
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'Changes Requested';

-- 2. Create Gate Status Enum
DO $$ BEGIN
    CREATE TYPE quality_gate_status AS ENUM ('Pending', 'Passed', 'Failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create Task Submission Audit Table
CREATE TABLE IF NOT EXISTS task_submission (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "taskId" TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
    submitted_by TEXT,
    proof_url TEXT NOT NULL,
    submission_notes TEXT NOT NULL,
    ai_confidence_score INTEGER NOT NULL,
    gate_status quality_gate_status NOT NULL,
    ai_summary TEXT NOT NULL,
    criteria_breakdown JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Composite Performance Index
CREATE INDEX IF NOT EXISTS idx_task_submission_task_created 
ON task_submission("taskId", created_at DESC);
