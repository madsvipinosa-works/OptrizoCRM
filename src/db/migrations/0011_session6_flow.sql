BEGIN;

-- Migration 0011: Session 6 Proposals Flow
-- Hand-written idempotent migration for Supabase SQL Editor

-- 1. Guard: abort before the unique index if any lead has 2 signed proposals
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "proposal" WHERE "status" = 'signed' GROUP BY "leadId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate signed proposals exist for a lead; resolve before running 0011';
  END IF;
END $$;

-- 2. Proposal signer columns & signature check constraint
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "signer_name" text;
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "signed_at" timestamptz;
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "signer_ip" text;
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "signature_type" text;
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "signed_file_url" text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposal_signature_type_check') THEN
    ALTER TABLE "proposal" ADD CONSTRAINT "proposal_signature_type_check" CHECK ("signature_type" IN ('online','paper'));
  END IF;
END $$;

-- 3. Backfill signed proposal metadata
UPDATE "proposal" SET
  "signer_name"    = COALESCE("signer_name", "accepted_by_name"),
  "signed_at"      = COALESCE("signed_at", "accepted_at"),
  "signer_ip"      = COALESCE("signer_ip", "accepted_ip"),
  "signature_type" = COALESCE("signature_type", 'online')
WHERE "status" = 'signed';

-- 4. Unique partial index: one signed proposal per lead
CREATE UNIQUE INDEX IF NOT EXISTS "idx_proposal_one_signed_per_lead" ON "proposal" ("leadId") WHERE "status" = 'signed';

-- 5. Proposal negotiation and discussion messages table
CREATE TABLE IF NOT EXISTS "proposal_message" (
  "id" text PRIMARY KEY,
  "proposal_id" text NOT NULL REFERENCES "proposal"("id") ON DELETE CASCADE,
  "author_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('change_request','message','reply','outside_discussion')),
  "topics" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "body" text NOT NULL,
  "outside_type" text CHECK ("outside_type" IN ('call','email','in_person')),
  "held_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_proposal_message_proposal" ON "proposal_message" ("proposal_id");

-- 6. Extend legacy milestone table with 5 fixed names and dates
ALTER TABLE "milestone" ADD COLUMN IF NOT EXISTS "name" "milestone_name";
ALTER TABLE "milestone" ADD COLUMN IF NOT EXISTS "start_date" timestamptz;
ALTER TABLE "milestone" ADD COLUMN IF NOT EXISTS "end_date" timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_milestone_project_name" ON "milestone" ("projectId", "name") WHERE "name" IS NOT NULL;

-- 7. Payment status enum and payment table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE "payment_status" AS ENUM ('not_yet_due','due','proof_uploaded','paid');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payment" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "agency_project"("id") ON DELETE CASCADE,
  "schedule_item_id" text REFERENCES "payment_schedule_item"("id") ON DELETE SET NULL,
  "label" text NOT NULL,
  "percent" integer NOT NULL,
  "amount" integer NOT NULL,
  "currency" "currency" NOT NULL,
  "status" "payment_status" NOT NULL DEFAULT 'not_yet_due',
  "became_due_at" timestamptz,
  "due_date" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_payment_project" ON "payment" ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_payment_project_item" ON "payment" ("project_id", "schedule_item_id") WHERE "schedule_item_id" IS NOT NULL;

COMMIT;

