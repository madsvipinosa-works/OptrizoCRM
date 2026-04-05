CREATE TYPE "public"."activity_type" AS ENUM('Call', 'Email', 'Meeting', 'Note');--> statement-breakpoint
CREATE TYPE "public"."agency_project_status" AS ENUM('Kickoff', 'In Progress', 'In Review', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('APPROVED', 'REVISION_REQUESTED');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('New', 'Contacted', 'In Progress', 'Completed', 'Lost', 'New Inquiry', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('Pending', 'In Progress', 'Client Approval', 'Completed');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('Draft', 'Sent', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin', 'editor', 'client');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('Todo', 'In Progress', 'Blocked', 'Done');--> statement-breakpoint
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
	"description" text,
	"leadId" text,
	"status" "agency_project_status" DEFAULT 'Kickoff' NOT NULL,
	"start_date" timestamp,
	"target_date" timestamp,
	"staging_urls" text[],
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "client_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"milestoneId" text NOT NULL,
	"clientId" text NOT NULL,
	"status" "feedback_status" NOT NULL,
	"comment_text" text,
	"parentFeedbackId" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_assignee" (
	"leadId" text NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "lead_assignee_leadId_userId_pk" PRIMARY KEY("leadId","userId")
);
--> statement-breakpoint
CREATE TABLE "lead_note" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text NOT NULL,
	"authorId" text NOT NULL,
	"content" text NOT NULL,
	"activity_type" "activity_type" DEFAULT 'Note' NOT NULL,
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
	"notes" text,
	"files" text[],
	"next_action_date" timestamp,
	"read" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"content" text,
	"clientName" text,
	"coverImage" text,
	"images" text[],
	"status" text DEFAULT 'published',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_slug_unique" UNIQUE("slug")
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
CREATE TABLE "service" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text,
	"order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY DEFAULT '1' NOT NULL,
	"heroTitle" text DEFAULT 'Build the Future',
	"heroDescription" text DEFAULT 'Premium software development agency crafting high-performance websites.',
	"aboutText" text,
	"logoUrl" text,
	"faviconUrl" text,
	"contactEmail" text,
	"notificationEmails" text,
	"demoVideoUrl" text,
	"monthly_marketing_spend" integer DEFAULT 1000 NOT NULL,
	"admin_hours_saved_per_project" integer DEFAULT 2 NOT NULL,
	"about_hero_title" text DEFAULT 'About Our Agency',
	"mission_statement" text,
	"company_stats" text,
	"about_tech_stack" text DEFAULT 'Powered By Next-Generation Technologies',
	"about_tech_stack_items" text,
	"about_cta_headline" text DEFAULT 'Ready to start your next project?',
	"about_cta_text" text DEFAULT 'Let''s build something extraordinary together.'
);
--> statement-breakpoint
CREATE TABLE "task_assignee" (
	"taskId" text NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "task_assignee_taskId_userId_pk" PRIMARY KEY("taskId","userId")
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
	"is_blocked_by_client" boolean DEFAULT false NOT NULL,
	"overdue_notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"role" "role" DEFAULT 'user' NOT NULL,
	"job_title" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"show_on_about_page" boolean DEFAULT false NOT NULL
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
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_parentFeedbackId_client_feedback_id_fk" FOREIGN KEY ("parentFeedbackId") REFERENCES "public"."client_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignee" ADD CONSTRAINT "lead_assignee_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignee" ADD CONSTRAINT "lead_assignee_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stakeholder" ADD CONSTRAINT "project_stakeholder_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stakeholder" ADD CONSTRAINT "project_stakeholder_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_taskId_task_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_agency_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."agency_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_milestoneId_milestone_id_fk" FOREIGN KEY ("milestoneId") REFERENCES "public"."milestone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_dependsOnTaskId_task_id_fk" FOREIGN KEY ("dependsOnTaskId") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;