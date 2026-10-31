CREATE TYPE "public"."activity_type" AS ENUM('System', 'Note', 'Email', 'Call', 'Meeting');--> statement-breakpoint
CREATE TYPE "public"."agency_project_status" AS ENUM('Kickoff', 'In Progress', 'In Review', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."crm_task_priority" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "public"."crm_task_status" AS ENUM('Pending', 'In Progress', 'Completed', 'Canceled');--> statement-breakpoint
CREATE TYPE "public"."crm_task_type" AS ENUM('Call', 'Email', 'Meeting', 'To-do');--> statement-breakpoint
CREATE TYPE "public"."error_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('APPROVED', 'REVISION_REQUESTED');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('Unread', 'Read', 'Archived');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('New Lead', 'Discovery & Qualifying', 'Proposal Sent', 'In Negotiation', 'Closed Won', 'Closed Lost');--> statement-breakpoint
CREATE TYPE "public"."loss_reason" AS ENUM('budget_too_low', 'competitor_chosen', 'scope_mismatch', 'timing_ghosted', 'internal_cancellation', 'other');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('Pending', 'In Progress', 'Client Approval', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('Draft', 'Sent', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."qualification_status" AS ENUM('Lead', 'MQL', 'SQL');--> statement-breakpoint
CREATE TYPE "public"."quality_gate_status" AS ENUM('Pending', 'Passed', 'Failed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('superadmin', 'sales', 'manager', 'developer', 'content_editor', 'client');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('Todo', 'In Progress', 'Blocked', 'Changes Requested', 'In Review', 'Done');--> statement-breakpoint
CREATE TABLE "about_value" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Zap',
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "agency_project" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"progress_percentage" integer DEFAULT 0 NOT NULL,
	"description" text,
	"source_brief" text,
	"leadId" text,
	"status" "agency_project_status" DEFAULT 'Kickoff' NOT NULL,
	"start_date" timestamp,
	"target_date" timestamp,
	"staging_urls" text[],
	"documents" jsonb,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"action" "audit_action" NOT NULL,
	"entity" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_study" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"content" text,
	"clientName" text,
	"coverImage" text,
	"gallery_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"order" text DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "case_study_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "client_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"milestoneId" text NOT NULL,
	"clientId" text,
	"status" "feedback_status" NOT NULL,
	"comment_text" text,
	"attachment_url" text,
	"attachment_name" text,
	"parentFeedbackId" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_task" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text NOT NULL,
	"assignedTo" text,
	"title" text NOT NULL,
	"description" text,
	"task_type" "crm_task_type" DEFAULT 'To-do' NOT NULL,
	"status" "crm_task_status" DEFAULT 'Pending' NOT NULL,
	"priority" "crm_task_priority" DEFAULT 'Medium' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiry" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"status" "inquiry_status" DEFAULT 'Unread' NOT NULL,
	"source" text DEFAULT 'Website Form',
	"ownerId" text,
	"nextAction" text,
	"isHandled" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "lead_assignee" (
	"leadId" text NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "lead_assignee_leadId_userId_pk" PRIMARY KEY("leadId","userId")
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text,
	"serviceId" text,
	"business_name" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"budget" text,
	"estimated_value" integer DEFAULT 0 NOT NULL,
	"lead_score" integer DEFAULT 50 NOT NULL,
	"qualification_status" "qualification_status" DEFAULT 'Lead' NOT NULL,
	"priority" text DEFAULT 'Warm' NOT NULL,
	"goals" text,
	"industry" text,
	"target_audience" text,
	"timeline_expectation" text,
	"status" "lead_status" DEFAULT 'New Lead' NOT NULL,
	"source" text DEFAULT 'Client Portal Intake',
	"last_contacted_at" timestamp with time zone,
	"next_follow_up_date" timestamp with time zone,
	"loss_reason" "loss_reason",
	"loss_notes" text,
	"isArchived" boolean DEFAULT false NOT NULL,
	"closed_won_at" timestamp with time zone,
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
	"completed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
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
CREATE TABLE "password_reset_token" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "password_reset_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"authorId" text,
	"coverImage" text,
	"excerpt" text,
	CONSTRAINT "post_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_stakeholder" (
	"projectId" text NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "project_stakeholder_projectId_userId_pk" PRIMARY KEY("projectId","userId")
);
--> statement-breakpoint
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
CREATE TABLE "proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text NOT NULL,
	"proposal_code" text,
	"scope" text,
	"deliverables" jsonb,
	"timeline" text,
	"technicalApproach" text,
	"pricingStructure" jsonb,
	"subtotal" integer DEFAULT 0,
	"discount" integer DEFAULT 0,
	"tax" integer DEFAULT 0,
	"total" integer DEFAULT 0,
	"terms" text,
	"valid_until" timestamp,
	"status" "proposal_status" DEFAULT 'Draft' NOT NULL,
	"fileUrl" text,
	"rejection_reason" text,
	"accepted_by_name" text,
	"accepted_by_email" text,
	"accepted_by_title" text,
	"signature_data" text,
	"accepted_at" timestamp,
	"accepted_ip" text,
	"accepted_user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"contractSettings" jsonb
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
CREATE TABLE "service" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"image" text,
	"color" text DEFAULT '#05160b',
	"link" text DEFAULT '/contact',
	"icon" text,
	"order" integer DEFAULT 0,
	"is_featured" boolean DEFAULT false NOT NULL,
	"slug" text,
	"inclusions" jsonb DEFAULT '[]'::jsonb,
	"deliverables" jsonb DEFAULT '[]'::jsonb,
	"scope_overview" text,
	"timeline_estimate" text DEFAULT '2-4 Weeks',
	"target_audience" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton_root' NOT NULL,
	"heroTitle" text DEFAULT 'Build the Future',
	"heroDescription" text DEFAULT 'Premium software development agency crafting high-performance websites.',
	"aboutText" text,
	"logoUrl" text,
	"logoDarkUrl" text,
	"faviconUrl" text,
	"contactEmail" text,
	"notificationEmails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"demoVideoUrl" text,
	"faqs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"about_hero_title" text DEFAULT 'About Our Agency',
	"mission_statement" text,
	"company_stats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"about_tech_stack" text DEFAULT 'Powered By Next-Generation Technologies',
	"about_tech_stack_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"about_cta_headline" text DEFAULT 'Ready to start your next project?',
	"about_cta_text" text DEFAULT 'Let''s build something extraordinary together.',
	CONSTRAINT "site_settings_singleton_check" CHECK ("site_settings"."id" = 'singleton_root')
);
--> statement-breakpoint
CREATE TABLE "system_error_log" (
	"id" text PRIMARY KEY NOT NULL,
	"error_code" text DEFAULT 'UNKNOWN_ERROR' NOT NULL,
	"severity" "error_severity" DEFAULT 'MEDIUM' NOT NULL,
	"message" text NOT NULL,
	"stack_trace" text,
	"source" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"userId" text,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" text,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignee" (
	"taskId" text NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "task_assignee_taskId_userId_pk" PRIMARY KEY("taskId","userId")
);
--> statement-breakpoint
CREATE TABLE "task_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"taskId" text NOT NULL,
	"submitted_by" text,
	"proof_url" text NOT NULL,
	"submission_notes" text NOT NULL,
	"ai_confidence_score" integer NOT NULL,
	"gate_status" "quality_gate_status" NOT NULL,
	"ai_summary" text NOT NULL,
	"criteria_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"milestoneId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"dependsOnTaskId" text,
	"due_date" timestamp,
	"status" "task_status" DEFAULT 'Todo' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"estimated_hours" integer,
	"proof_links" jsonb DEFAULT '[]'::jsonb,
	"proof_notes" text,
	"requires_proof" boolean DEFAULT true NOT NULL,
	"is_blocked_by_client" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	"overdue_notified" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "testimonial" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"company" text,
	"content" text NOT NULL,
	"rating" integer DEFAULT 5,
	"image" text,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"password" text,
	"image" text,
	"role" "role" DEFAULT 'client' NOT NULL,
	"job_title" text,
	"company_name" text,
	"industry" text,
	"linkedin_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_on_about_page" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_project" ADD CONSTRAINT "agency_project_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_milestoneId_milestone_id_fk" FOREIGN KEY ("milestoneId") REFERENCES "public"."milestone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "parent_feedback_fk" FOREIGN KEY ("parentFeedbackId") REFERENCES "public"."client_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_task" ADD CONSTRAINT "crm_task_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_task" ADD CONSTRAINT "crm_task_assignedTo_user_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity_log" ADD CONSTRAINT "lead_activity_log_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity_log" ADD CONSTRAINT "lead_activity_log_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignee" ADD CONSTRAINT "lead_assignee_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignee" ADD CONSTRAINT "lead_assignee_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stakeholder" ADD CONSTRAINT "project_stakeholder_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stakeholder" ADD CONSTRAINT "project_stakeholder_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_member" ADD CONSTRAINT "project_team_member_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_error_log" ADD CONSTRAINT "system_error_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_error_log" ADD CONSTRAINT "system_error_log_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_taskId_task_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_submission" ADD CONSTRAINT "task_submission_taskId_task_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_template" ADD CONSTRAINT "task_template_serviceTemplateId_service_template_id_fk" FOREIGN KEY ("serviceTemplateId") REFERENCES "public"."service_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_milestoneId_milestone_id_fk" FOREIGN KEY ("milestoneId") REFERENCES "public"."milestone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_depends_on_fk" FOREIGN KEY ("dependsOnTaskId") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_project_lead" ON "agency_project" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "idx_project_status" ON "agency_project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_case_studies_slug" ON "case_study" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_case_studies_published" ON "case_study" USING btree ("published");--> statement-breakpoint
CREATE INDEX "idx_crm_task_lead" ON "crm_task" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "idx_crm_task_assignee_status" ON "crm_task" USING btree ("assignedTo","status");--> statement-breakpoint
CREATE INDEX "idx_crm_task_due_status" ON "crm_task" USING btree ("due_date","status");--> statement-breakpoint
CREATE INDEX "idx_lead_status_archived" ON "lead" USING btree ("status","isArchived");--> statement-breakpoint
CREATE INDEX "idx_lead_client" ON "lead" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "idx_lead_last_contacted" ON "lead" USING btree ("last_contacted_at");--> statement-breakpoint
CREATE INDEX "idx_milestone_project" ON "milestone" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "idx_posts_published_created" ON "post" USING btree ("published","created_at");--> statement-breakpoint
CREATE INDEX "idx_proposal_lead" ON "proposal" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "idx_proposal_code" ON "proposal" USING btree ("proposal_code");--> statement-breakpoint
CREATE INDEX "idx_error_created" ON "system_error_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_error_severity" ON "system_error_log" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_error_resolved" ON "system_error_log" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "idx_error_code" ON "system_error_log" USING btree ("error_code");--> statement-breakpoint
CREATE INDEX "idx_task_submission_task_created" ON "task_submission" USING btree ("taskId","created_at");--> statement-breakpoint
CREATE INDEX "idx_task_project_deleted" ON "task" USING btree ("projectId","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_task_milestone_deleted" ON "task" USING btree ("milestoneId","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_task_project_status" ON "task" USING btree ("projectId","status");--> statement-breakpoint
CREATE INDEX "idx_task_milestone_status" ON "task" USING btree ("milestoneId","status");