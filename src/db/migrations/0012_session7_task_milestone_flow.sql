BEGIN;
-- 0012 session 7: task statuses, milestone/task columns, count-based progress, team backfill

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'task_status' AND e.enumlabel = 'Blocked') THEN
    RAISE EXCEPTION 'task_status still has Blocked; resolve before 0012';
  END IF;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('Todo','to_do'),('In Progress','in_progress'),('Changes Requested','changes_requested'),('In Review','in_review'),('Done','done')) AS v(o, n) LOOP
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'task_status' AND e.enumlabel = r.o) THEN
      EXECUTE format('ALTER TYPE task_status RENAME VALUE %L TO %L', r.o, r.n);
    END IF;
  END LOOP;
END $$;

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'backlog' BEFORE 'to_do';

ALTER TABLE milestone ADD COLUMN IF NOT EXISTS done_reason text;
ALTER TABLE task ADD COLUMN IF NOT EXISTS review_note text;

-- legacy fix: keep only the lowest-order In Progress milestone per project
UPDATE milestone m SET status = 'Pending', updated_at = now()
WHERE m.status = 'In Progress' AND m.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM milestone m2
    WHERE m2."projectId" = m."projectId" AND m2.status = 'In Progress' AND m2.deleted_at IS NULL
      AND (m2."order" < m."order" OR (m2."order" = m."order" AND m2.id < m.id))
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_milestone_one_in_progress ON milestone ("projectId") WHERE status = 'In Progress' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION get_project_progress(p_project_id TEXT) RETURNS JSON AS $f$
DECLARE total_c INT; done_c INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'done') INTO total_c, done_c
  FROM task WHERE "projectId" = p_project_id AND deleted_at IS NULL;
  RETURN json_build_object('totalWeight', total_c, 'completedWeight', done_c,
    'percentage', CASE WHEN total_c = 0 THEN 0 ELSE ROUND(done_c::numeric / total_c * 100, 2) END);
END; $f$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION trigger_sync_project_progress() RETURNS TRIGGER AS $f$
DECLARE pid TEXT; total_c INT; done_c INT;
BEGIN
  pid := CASE WHEN TG_OP = 'DELETE' THEN OLD."projectId" ELSE NEW."projectId" END;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'done') INTO total_c, done_c
  FROM task WHERE "projectId" = pid AND deleted_at IS NULL;
  UPDATE agency_project
  SET progress_percentage = CASE WHEN total_c = 0 THEN 0 ELSE ROUND(done_c::numeric / total_c * 100)::int END
  WHERE id = pid;
  RETURN NULL;
END; $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_progress_sync ON task;
CREATE TRIGGER trg_task_progress_sync AFTER INSERT OR DELETE OR UPDATE OF status, "projectId", deleted_at ON task
  FOR EACH ROW EXECUTE FUNCTION trigger_sync_project_progress();

UPDATE agency_project p SET progress_percentage = COALESCE((
  SELECT ROUND(COUNT(*) FILTER (WHERE t.status = 'done')::numeric / NULLIF(COUNT(*), 0) * 100)::int
  FROM task t WHERE t."projectId" = p.id AND t.deleted_at IS NULL), 0);

INSERT INTO project_team_member ("projectId", "userId")
SELECT DISTINCT t."projectId", ta."userId"
FROM task_assignee ta
JOIN task t ON t.id = ta."taskId" AND t.deleted_at IS NULL
JOIN "user" u ON u.id = ta."userId"
WHERE u.role = 'developer'
ON CONFLICT DO NOTHING;

COMMIT;
