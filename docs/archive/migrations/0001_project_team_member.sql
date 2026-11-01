CREATE TABLE "project_team_member" (
	"projectId" text NOT NULL,
	"userId" text NOT NULL,
	"role_in_project" text,
	"is_assignable" boolean DEFAULT true NOT NULL,
	"added_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_team_member_projectId_userId_pk" PRIMARY KEY("projectId","userId")
);
--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Backfill existing active projects from current task assignments.
INSERT INTO "project_team_member" ("projectId", "userId", "is_assignable")
SELECT DISTINCT t."projectId", ta."userId", true
FROM "task_assignee" ta
JOIN "task" t ON t."id" = ta."taskId"
JOIN "agency_project" ap ON ap."id" = t."projectId"
JOIN "user" u ON u."id" = ta."userId"
WHERE ap."is_archived" = false
  AND u."role" <> 'client'
ON CONFLICT ("projectId", "userId") DO NOTHING;
