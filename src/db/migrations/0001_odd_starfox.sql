CREATE TYPE "public"."activity_type" AS ENUM('Call', 'Email', 'Meeting', 'Note');--> statement-breakpoint
CREATE TYPE "public"."agency_project_status" AS ENUM('Kickoff', 'In Progress', 'In Review', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('APPROVED', 'REVISION_REQUESTED');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('New Inquiry', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('Pending', 'In Progress', 'Client Approval', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('Draft', 'Sent', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('Todo', 'In Progress', 'Blocked', 'Done');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'client';--> statement-breakpoint
CREATE TABLE "agency_project" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"clientId" text NOT NULL,
	"leadId" text,
	"status" "agency_project_status" DEFAULT 'Kickoff' NOT NULL,
	"start_date" timestamp,
	"target_date" timestamp,
	"staging_urls" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"milestoneId" text NOT NULL,
	"clientId" text NOT NULL,
	"status" "feedback_status" NOT NULL,
	"comment_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_note" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text NOT NULL,
	"authorId" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"status" "lead_status" DEFAULT 'New Inquiry' NOT NULL,
	"score" integer DEFAULT 0,
	"budget" text,
	"service" text,
	"industry" text,
	"scope" text,
	"source" text DEFAULT 'Website Form',
	"assignedTo" text,
	"files" text[],
	"next_action_date" timestamp,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"title" text NOT NULL,
	"status" "milestone_status" DEFAULT 'Pending' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"message" text NOT NULL,
	"type" text,
	"read" boolean DEFAULT false NOT NULL,
	"link" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text NOT NULL,
	"scope" text,
	"deliverables" text,
	"timeline" text,
	"technicalApproach" text,
	"pricingStructure" text,
	"status" "proposal_status" DEFAULT 'Draft' NOT NULL,
	"fileUrl" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"milestoneId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assigneeId" text,
	"due_date" timestamp,
	"status" "task_status" DEFAULT 'Todo' NOT NULL,
	"is_blocked_by_client" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "message" CASCADE;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "notificationEmails" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "demoVideoUrl" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "monthly_marketing_spend" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "admin_hours_saved_per_project" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_project" ADD CONSTRAINT "agency_project_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_project" ADD CONSTRAINT "agency_project_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_milestoneId_milestone_id_fk" FOREIGN KEY ("milestoneId") REFERENCES "public"."milestone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_assignedTo_user_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_milestoneId_milestone_id_fk" FOREIGN KEY ("milestoneId") REFERENCES "public"."milestone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assigneeId_user_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;