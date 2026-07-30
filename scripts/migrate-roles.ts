import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    console.log("Starting RBAC Enum Migration...");

    try {
        await pool.query("BEGIN");

        console.log("1. Renaming old enum...");
        await pool.query(`ALTER TYPE role RENAME TO role_old;`);

        console.log("2. Creating new enum...");
        await pool.query(`CREATE TYPE role AS ENUM ('superadmin', 'sales', 'manager', 'developer', 'content_editor', 'client');`);

        console.log("3. Migrating users and updating column type...");
        await pool.query(`
            ALTER TABLE "user" 
            ALTER COLUMN role DROP DEFAULT,
            ALTER COLUMN role TYPE role USING (
                CASE 
                    WHEN role::text = 'admin' THEN 'superadmin'
                    WHEN role::text = 'editor' THEN 'content_editor'
                    WHEN role::text = 'user' THEN 'client'
                    WHEN role::text = 'client' THEN 'client'
                    ELSE 'client'
                END
            )::role;
        `);

        console.log("4. Setting new default...");
        await pool.query(`ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'client'::role;`);

        console.log("5. Dropping old enum...");
        await pool.query(`DROP TYPE role_old;`);

        await pool.query("COMMIT");
        console.log("✅ Migration completed successfully!");
    } catch (e) {
        await pool.query("ROLLBACK");
        console.error("❌ Migration failed:", e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
