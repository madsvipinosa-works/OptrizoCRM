ALTER TABLE "milestone" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "milestone" ALTER COLUMN "status" SET DEFAULT 'Pending'::text;--> statement-breakpoint
DROP TYPE "public"."milestone_status";--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('Pending', 'In Progress', 'Completed');--> statement-breakpoint
ALTER TABLE "milestone" ALTER COLUMN "status" SET DEFAULT 'Pending'::"public"."milestone_status";--> statement-breakpoint
ALTER TABLE "milestone" ALTER COLUMN "status" SET DATA TYPE "public"."milestone_status" USING "status"::"public"."milestone_status";--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" SET DEFAULT 'Todo'::text;--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('Todo', 'In Progress', 'Changes Requested', 'In Review', 'Done');--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" SET DEFAULT 'Todo'::"public"."task_status";--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" SET DATA TYPE "public"."task_status" USING "status"::"public"."task_status";