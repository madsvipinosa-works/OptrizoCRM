CREATE TYPE "public"."inquiry_status" AS ENUM('Unread', 'Read', 'Archived');--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'In Review' BEFORE 'Done';--> statement-breakpoint
CREATE TABLE "inquiry" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"status" "inquiry_status" DEFAULT 'Unread' NOT NULL,
	"source" text DEFAULT 'Website Form',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text NOT NULL,
	"authorId" text,
	"activity_type" "activity_type" DEFAULT 'System' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_template" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_template_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "task_template" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceTemplateId" text NOT NULL,
	"milestone_title" text NOT NULL,
	"milestone_order" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"requires_proof" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_note" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lead_note" CASCADE;--> statement-breakpoint
ALTER TABLE "lead_activity_log" ALTER COLUMN "activity_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lead_activity_log" ALTER COLUMN "activity_type" SET DEFAULT 'System'::text;--> statement-breakpoint
DROP TYPE "public"."activity_type";--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('System', 'Note', 'Email', 'Call', 'Meeting');--> statement-breakpoint
ALTER TABLE "lead_activity_log" ALTER COLUMN "activity_type" SET DEFAULT 'System'::"public"."activity_type";--> statement-breakpoint
ALTER TABLE "lead_activity_log" ALTER COLUMN "activity_type" SET DATA TYPE "public"."activity_type" USING "activity_type"::"public"."activity_type";--> statement-breakpoint
ALTER TABLE "lead" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lead" ALTER COLUMN "status" SET DEFAULT 'Pending Approval'::text;--> statement-breakpoint
DROP TYPE "public"."lead_status";--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('Pending Approval', 'In Review', 'Proposal Sent', 'Closed Won', 'Closed Lost');--> statement-breakpoint
ALTER TABLE "lead" ALTER COLUMN "status" SET DEFAULT 'Pending Approval'::"public"."lead_status";--> statement-breakpoint
ALTER TABLE "lead" ALTER COLUMN "status" SET DATA TYPE "public"."lead_status" USING "status"::"public"."lead_status";--> statement-breakpoint
ALTER TABLE "lead" ALTER COLUMN "source" SET DEFAULT 'Client Portal Intake';--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "clientId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "serviceId" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "business_name" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "goals" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "target_audience" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "timeline_expectation" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "proof_url" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "proof_notes" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "requires_proof" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "lead_activity_log" ADD CONSTRAINT "lead_activity_log_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity_log" ADD CONSTRAINT "lead_activity_log_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template" ADD CONSTRAINT "task_template_serviceTemplateId_service_template_id_fk" FOREIGN KEY ("serviceTemplateId") REFERENCES "public"."service_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "subject";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "message";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "score";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "service";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "scope";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "files";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "next_action_date";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "read";--> statement-breakpoint
ALTER TABLE "lead" DROP COLUMN "is_archived";