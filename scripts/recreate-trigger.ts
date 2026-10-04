import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
    await db.execute(sql`
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
    `);

    await db.execute(sql`
        DROP TRIGGER IF EXISTS trg_task_progress_sync ON task;
    `);

    await db.execute(sql`
        CREATE TRIGGER trg_task_progress_sync
        AFTER INSERT OR UPDATE OF status, weight, "projectId", deleted_at OR DELETE
        ON task
        FOR EACH ROW
        EXECUTE FUNCTION trigger_sync_project_progress();
    `);

    console.log("Trigger recreated successfully.");
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
