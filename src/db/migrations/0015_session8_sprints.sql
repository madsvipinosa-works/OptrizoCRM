BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS sprint (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES agency_project(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sprint_dates_check CHECK (end_date >= start_date),
  CONSTRAINT sprint_id_project_uniq UNIQUE (id, project_id),
  CONSTRAINT sprint_no_overlap EXCLUDE USING gist
    (project_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sprint_project_name ON sprint (project_id, lower(name));

ALTER TABLE sprint ENABLE ROW LEVEL SECURITY;   -- no policies

ALTER TABLE task ADD COLUMN IF NOT EXISTS sprint_id text;
ALTER TABLE task ADD COLUMN IF NOT EXISTS carried_over boolean NOT NULL DEFAULT false;

-- guarded DO block: composite FK so a task cannot point at another project's sprint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_sprint_same_project_fk') THEN
    ALTER TABLE task ADD CONSTRAINT task_sprint_same_project_fk
      FOREIGN KEY (sprint_id, "projectId") REFERENCES sprint(id, project_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_task_sprint ON task (sprint_id) WHERE sprint_id IS NOT NULL;

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS project_id text;   -- no FK, rows must outlive projects
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log (project_id, created_at DESC) WHERE project_id IS NOT NULL;

-- OPTIONAL, commented, run only after check 5 (decision D3):
-- UPDATE task t SET status='backlog' FROM milestone m WHERE m.id=t."milestoneId" AND m.name='development' AND t.status='to_do' AND t.sprint_id IS NULL AND t.deleted_at IS NULL;

COMMIT;

