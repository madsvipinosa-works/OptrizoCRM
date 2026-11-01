ALTER TABLE "agency_project" ADD COLUMN "progress_percentage" integer DEFAULT 0 NOT NULL;
ALTER TABLE "task" ADD COLUMN "weight" integer DEFAULT 1 NOT NULL;
ALTER TABLE "task" ADD COLUMN "estimated_hours" integer;

-- 1. Function to calculate detailed weighted metrics for a project
CREATE OR REPLACE FUNCTION get_project_progress(p_project_id TEXT)
RETURNS JSON AS $$
DECLARE
    total_w INT;
    done_w INT;
    calc_percentage NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(weight), 0),
        COALESCE(SUM(CASE WHEN status = 'Done' THEN weight ELSE 0 END), 0)
    INTO total_w, done_w
    FROM task
    WHERE "projectId" = p_project_id 
      AND (deleted_at IS NULL); 

    IF total_w = 0 THEN
        calc_percentage := 0;
    ELSE
        calc_percentage := ROUND((done_w::NUMERIC / total_w::NUMERIC) * 100, 2);
    END IF;

    RETURN json_build_object(
        'totalWeight', total_w,
        'completedWeight', done_w,
        'percentage', calc_percentage
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Trigger Function: Automatically syncs project.progress_percentage
CREATE OR REPLACE FUNCTION trigger_sync_project_progress()
RETURNS TRIGGER AS $$
DECLARE
    target_project_id TEXT;
    new_progress NUMERIC;
    total_w INT;
    done_w INT;
BEGIN
    -- Determine target project ID from INSERT, UPDATE, or DELETE
    IF (TG_OP = 'DELETE') THEN
        target_project_id := OLD."projectId";
    ELSE
        target_project_id := NEW."projectId";
    END IF;

    -- Compute new percentage
    SELECT 
        COALESCE(SUM(weight), 0),
        COALESCE(SUM(CASE WHEN status = 'Done' THEN weight ELSE 0 END), 0)
    INTO total_w, done_w
    FROM task
    WHERE "projectId" = target_project_id 
      AND (deleted_at IS NULL);

    IF total_w = 0 THEN
        new_progress := 0;
    ELSE
        new_progress := ROUND((done_w::NUMERIC / total_w::NUMERIC) * 100, 0);
    END IF;

    -- Update agency_project table autonomously
    UPDATE agency_project 
    SET progress_percentage = new_progress::INT
    WHERE id = target_project_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger to Task Mutations
DROP TRIGGER IF EXISTS trg_task_progress_sync ON task;
CREATE TRIGGER trg_task_progress_sync
AFTER INSERT OR UPDATE OF status, weight, "projectId", deleted_at OR DELETE
ON task
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_project_progress();
