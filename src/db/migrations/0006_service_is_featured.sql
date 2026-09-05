ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;

-- Automatically mark the top 4 services as featured if none are currently featured
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "service" WHERE "is_featured" = true) THEN
        UPDATE "service"
        SET "is_featured" = true
        WHERE "id" IN (
            SELECT "id" FROM "service"
            ORDER BY "order" ASC
            LIMIT 4
        );
    END IF;
END $$;
