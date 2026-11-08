-- 0022: two optional feedback questions (step 31, docs/proposals/project-feedback-plan.md).
-- Idempotent. Hand-applied like 0010-0021. Run before deploying the code that reads these columns.

BEGIN;

ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS recommend_score integer;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS improvement text;
ALTER TABLE project_feedback DROP CONSTRAINT IF EXISTS project_feedback_recommend_range;
ALTER TABLE project_feedback ADD CONSTRAINT project_feedback_recommend_range
  CHECK (recommend_score IS NULL OR (recommend_score >= 0 AND recommend_score <= 10));

COMMIT;
