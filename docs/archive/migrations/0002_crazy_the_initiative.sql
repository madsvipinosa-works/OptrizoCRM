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
ALTER TABLE "client_feedback" DROP CONSTRAINT "client_feedback_parentFeedbackId_client_feedback_id_fk";
--> statement-breakpoint
ALTER TABLE "client_feedback" DROP CONSTRAINT "client_feedback_clientId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_dependsOnTaskId_task_id_fk";
--> statement-breakpoint
ALTER TABLE "client_feedback" ALTER COLUMN "clientId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_project" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "milestone" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "proposal" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "parent_feedback_fk" FOREIGN KEY ("parentFeedbackId") REFERENCES "public"."client_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_depends_on_fk" FOREIGN KEY ("dependsOnTaskId") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;