BEGIN;

-- Migration 0010: Session 5 Proposals Core
-- Hand-written idempotent migration for Supabase SQL Editor

-- 1. Item 1: assigned_pm_id on leads ("lead" table)
-- Note: No index on assigned_pm_id
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "assigned_pm_id" text REFERENCES "user"("id") ON DELETE SET NULL;

-- 2. Item 3: Proposals version and 7 statuses
-- 2a. Add version column
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;

-- 2b. Version backfill with tie-breaker
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "leadId" ORDER BY "created_at" ASC, id ASC) AS rn
    FROM "proposal"
)
UPDATE "proposal" p
SET "version" = n.rn
FROM numbered n
WHERE p.id = n.id AND (p."version" IS NULL OR p."version" = 1);

-- 2c. Unique index on (leadId, version)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_proposal_lead_version" ON "proposal" ("leadId", "version");

-- 2d. Status enum migration and replaced marking (one-time DO block)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'proposal_status' AND e.enumlabel = 'Draft'
    ) THEN
        -- Drop default on proposal.status if any
        ALTER TABLE "proposal" ALTER COLUMN "status" DROP DEFAULT;

        -- Alter column to text
        ALTER TABLE "proposal" ALTER COLUMN "status" TYPE text USING "status"::text;

        -- Map values to lowercase
        UPDATE "proposal" SET "status" = CASE
            WHEN "status" = 'Draft' THEN 'draft'
            WHEN "status" = 'Sent' THEN 'sent'
            WHEN "status" = 'Approved' THEN 'signed'
            WHEN "status" = 'Rejected' THEN 'declined'
            ELSE LOWER("status")
        END;

        -- Drop old enum
        DROP TYPE "proposal_status";

        -- Create new enum
        CREATE TYPE "proposal_status" AS ENUM (
            'draft',
            'sent',
            'pricing_meeting_requested',
            'changes_requested',
            'signed',
            'declined',
            'replaced'
        );

        -- Cast column back to new enum
        ALTER TABLE "proposal" ALTER COLUMN "status" TYPE "proposal_status" USING "status"::"proposal_status";

        -- Mark every non-latest 'sent' proposal of the same lead as 'replaced' (version < max version of that lead)
        WITH max_versions AS (
            SELECT "leadId", MAX("version") AS max_v
            FROM "proposal"
            GROUP BY "leadId"
        )
        UPDATE "proposal" p
        SET "status" = 'replaced'::"proposal_status"
        FROM max_versions mv
        WHERE p."leadId" = mv."leadId"
          AND p."status" = 'sent'::"proposal_status"
          AND p."version" < mv.max_v;

        -- Set default to 'draft'
        ALTER TABLE "proposal" ALTER COLUMN "status" SET DEFAULT 'draft'::"proposal_status";
    END IF;
END $$;

-- 3. Item 4: priceMode, currency, totalPrice
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'price_mode') THEN
        CREATE TYPE "price_mode" AS ENUM ('to_be_discussed', 'priced');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency') THEN
        CREATE TYPE "currency" AS ENUM ('PHP', 'USD');
    END IF;
END $$;

ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "price_mode" "price_mode" NOT NULL DEFAULT 'to_be_discussed';
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "currency" "currency" NOT NULL DEFAULT 'PHP';
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "total_price" integer;

-- Guarded backfill: ONLY for status IN ('sent', 'signed', 'declined') where total IS NOT NULL AND total > 0
UPDATE "proposal"
SET "price_mode" = 'priced'::"price_mode",
    "total_price" = "total"
WHERE "status" IN ('sent'::"proposal_status", 'signed'::"proposal_status", 'declined'::"proposal_status")
  AND "total" IS NOT NULL
  AND "total" > 0
  AND "total_price" IS NULL
  AND "price_mode" = 'to_be_discussed'::"price_mode";

-- 4. Item 5: needs_goals on proposal
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "needs_goals" text;

UPDATE "proposal"
SET "needs_goals" = "scope"
WHERE "needs_goals" IS NULL AND "scope" IS NOT NULL;

COMMIT;
