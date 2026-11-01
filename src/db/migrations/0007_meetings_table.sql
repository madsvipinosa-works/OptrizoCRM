CREATE TYPE "public"."meeting_format" AS ENUM('video', 'phone', 'in_person', 'on_site');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('awaiting_client', 'confirmed', 'reschedule_requested', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('discovery', 'budget_pricing', 'project_review', 'uat');--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text,
	"proposalId" text,
	"projectId" text,
	"type" "meeting_type" DEFAULT 'discovery' NOT NULL,
	"format" "meeting_format" DEFAULT 'video' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agenda" text,
	"notes" text,
	"status" "meeting_status" DEFAULT 'awaiting_client' NOT NULL,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"client_suggested_at" timestamp with time zone,
	"decline_reason" text,
	"createdBy" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_proposalId_proposal_id_fk" FOREIGN KEY ("proposalId") REFERENCES "public"."proposal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_meeting_lead" ON "meeting" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "idx_meeting_starts_at" ON "meeting" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_meeting_status" ON "meeting" USING btree ("status");