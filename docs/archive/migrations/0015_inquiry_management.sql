ALTER TABLE "inquiry"
    ADD COLUMN IF NOT EXISTS "ownerId" text;
--> statement-breakpoint

ALTER TABLE "inquiry"
    ADD COLUMN IF NOT EXISTS "nextAction" text;
--> statement-breakpoint

ALTER TABLE "inquiry"
    ADD COLUMN IF NOT EXISTS "isHandled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inquiry_ownerId_user_id_fk'
    ) THEN
        ALTER TABLE "inquiry"
            ADD CONSTRAINT "inquiry_ownerId_user_id_fk"
            FOREIGN KEY ("ownerId") REFERENCES "user"("id")
            ON DELETE SET NULL;
    END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_inquiry_owner" ON "inquiry" ("ownerId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inquiry_handled_created" ON "inquiry" ("isHandled", "created_at" DESC);
