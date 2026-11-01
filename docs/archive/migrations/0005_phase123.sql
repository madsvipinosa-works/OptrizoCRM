-- Update leads.clientId
ALTER TABLE "lead" DROP CONSTRAINT "lead_clientId_user_id_fk";
ALTER TABLE "lead" ADD CONSTRAINT "lead_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

-- Update agency_project.leadId
ALTER TABLE "agency_project" DROP CONSTRAINT "agency_project_leadId_lead_id_fk";
ALTER TABLE "agency_project" ADD CONSTRAINT "agency_project_leadId_lead_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."lead"("id") ON DELETE restrict ON UPDATE no action;

-- Update tasks.dependsOnTaskId
ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "task_depends_on_fk";
ALTER TABLE "task" ADD CONSTRAINT "task_depends_on_fk" FOREIGN KEY ("dependsOnTaskId") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;

-- Update proposals JSONB
ALTER TABLE "proposal" ALTER COLUMN "deliverables" TYPE jsonb USING COALESCE(CASE WHEN "deliverables" = '' THEN '[]'::jsonb ELSE "deliverables"::jsonb END, '[]'::jsonb);
ALTER TABLE "proposal" ALTER COLUMN "pricingStructure" TYPE jsonb USING COALESCE(CASE WHEN "pricingStructure" = '' THEN '[]'::jsonb ELSE "pricingStructure"::jsonb END, '[]'::jsonb);

-- Rename project to case_study and modify columns
ALTER TABLE "project" RENAME TO "case_study";
ALTER TABLE "case_study" RENAME COLUMN "images" TO "gallery_images";
ALTER TABLE "case_study" ALTER COLUMN "gallery_images" TYPE jsonb USING COALESCE(to_jsonb("gallery_images"), '[]'::jsonb);
ALTER TABLE "case_study" ALTER COLUMN "gallery_images" SET DEFAULT '[]'::jsonb;
ALTER TABLE "case_study" ALTER COLUMN "gallery_images" SET NOT NULL;

ALTER TABLE "case_study" ADD COLUMN "technologies" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "case_study" ADD COLUMN "order" text DEFAULT '0' NOT NULL;
ALTER TABLE "case_study" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "case_study" RENAME COLUMN "status" TO "published";
ALTER TABLE "case_study" ALTER COLUMN "published" DROP DEFAULT;
ALTER TABLE "case_study" ALTER COLUMN "published" TYPE boolean USING ("published" = 'published');
ALTER TABLE "case_study" ALTER COLUMN "published" SET DEFAULT true;
ALTER TABLE "case_study" ALTER COLUMN "published" SET NOT NULL;

-- Site Settings
UPDATE "site_settings" SET "id" = 'singleton_root' WHERE "id" = '1';
ALTER TABLE "site_settings" ALTER COLUMN "id" SET DEFAULT 'singleton_root';
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_singleton_check" CHECK ("id" = 'singleton_root');

ALTER TABLE "site_settings" ALTER COLUMN "notificationEmails" TYPE jsonb USING COALESCE(to_jsonb(string_to_array("notificationEmails", ',')), '[]'::jsonb);
ALTER TABLE "site_settings" ALTER COLUMN "notificationEmails" SET DEFAULT '[]'::jsonb;
ALTER TABLE "site_settings" ALTER COLUMN "notificationEmails" SET NOT NULL;

ALTER TABLE "site_settings" ALTER COLUMN "company_stats" TYPE jsonb USING COALESCE(CASE WHEN "company_stats" = '' THEN '[]'::jsonb ELSE "company_stats"::jsonb END, '[]'::jsonb);
ALTER TABLE "site_settings" ALTER COLUMN "company_stats" SET DEFAULT '[]'::jsonb;
ALTER TABLE "site_settings" ALTER COLUMN "company_stats" SET NOT NULL;

ALTER TABLE "site_settings" ALTER COLUMN "about_tech_stack_items" TYPE jsonb USING COALESCE(CASE WHEN "about_tech_stack_items" = '' THEN '[]'::jsonb ELSE "about_tech_stack_items"::jsonb END, '[]'::jsonb);
ALTER TABLE "site_settings" ALTER COLUMN "about_tech_stack_items" SET DEFAULT '[]'::jsonb;
ALTER TABLE "site_settings" ALTER COLUMN "about_tech_stack_items" SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_posts_published_created" ON "post" ("published", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_task_project_status" ON "task" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "idx_task_milestone_status" ON "task" ("milestoneId", "status");
CREATE INDEX IF NOT EXISTS "idx_case_studies_slug" ON "case_study" ("slug");
CREATE INDEX IF NOT EXISTS "idx_case_studies_published" ON "case_study" ("published");