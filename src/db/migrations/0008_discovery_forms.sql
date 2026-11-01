CREATE TYPE "public"."client_type" AS ENUM('local', 'international');--> statement-breakpoint
CREATE TABLE "discovery_form" (
	"id" text PRIMARY KEY NOT NULL,
	"leadId" text NOT NULL,
	"goals" text NOT NULL,
	"required_features" text NOT NULL,
	"target_timeline" text NOT NULL,
	"budget_range" text NOT NULL,
	"client_type" "client_type" DEFAULT 'local' NOT NULL,
	"notes" text,
	"submitted_by" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "client_type" "client_type" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "proposal_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discovery_form" ADD CONSTRAINT "discovery_form_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_form" ADD CONSTRAINT "discovery_form_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_discovery_form_lead" ON "discovery_form" USING btree ("leadId");