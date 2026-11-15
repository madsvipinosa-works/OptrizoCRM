-- 0024: task deliverables and progress updates (panel feedback, steps 22-26).
--   task.attachments   the files and links the PM attaches to a task (Deliverables in the task drawer).
--   task_update        what happened on a task, in order: progress notes, submissions, change requests, approvals.
-- Idempotent. Hand-applied like 0010-0023: run it in the Supabase SQL editor BEFORE deploying the code that reads these.
-- Existing data is untouched. tasks.proof_links stays as "the latest submission".

BEGIN;

ALTER TABLE task ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS task_update (
  id text PRIMARY KEY,
  "taskId" text NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  author_id text REFERENCES "user"(id) ON DELETE SET NULL,
  kind text NOT NULL,
  note text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_update_kind_check CHECK (kind IN ('progress', 'submission', 'changes_requested', 'approved'))
);

CREATE INDEX IF NOT EXISTS idx_task_update_task_created ON task_update ("taskId", created_at);

COMMIT;
