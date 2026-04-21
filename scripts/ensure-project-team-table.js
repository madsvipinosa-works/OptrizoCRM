require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/optrizo",
  });

  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS "project_team_member" (
      "projectId" text NOT NULL REFERENCES "agency_project"("id") ON DELETE cascade,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
      "role_in_project" text,
      "is_assignable" boolean NOT NULL DEFAULT true,
      "added_by" text REFERENCES "user"("id") ON DELETE set null,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY ("projectId", "userId")
    );
  `);

  await client.query(`
    INSERT INTO "project_team_member" ("projectId", "userId", "is_assignable")
    SELECT DISTINCT t."projectId", ta."userId", true
    FROM "task_assignee" ta
    JOIN "task" t ON t."id" = ta."taskId"
    JOIN "agency_project" ap ON ap."id" = t."projectId"
    JOIN "user" u ON u."id" = ta."userId"
    WHERE ap."is_archived" = false
      AND u."role" <> 'client'
    ON CONFLICT ("projectId", "userId") DO NOTHING;
  `);

  await client.end();
  console.log("project_team_member table ensured and backfilled.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
