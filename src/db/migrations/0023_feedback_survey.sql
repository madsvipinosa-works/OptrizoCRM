-- 0023: the full client survey at step 31 (five area ratings, would-recommend, testimonial consent, PM follow-up).
-- Replaces the 0-10 recommend score added in 0022 (nothing reads it any more). Idempotent. Hand-applied like 0010-0022.
-- Run before deploying the code that reads these columns.

BEGIN;

ALTER TABLE project_feedback DROP CONSTRAINT IF EXISTS project_feedback_recommend_range;
ALTER TABLE project_feedback DROP COLUMN IF EXISTS recommend_score;

ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS rating_communication integer;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS rating_quality integer;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS rating_on_time integer;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS rating_value integer;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS rating_pm_support integer;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS would_recommend text;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS testimonial_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS followup_note text;
ALTER TABLE project_feedback ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE project_feedback DROP CONSTRAINT IF EXISTS project_feedback_areas_range;
ALTER TABLE project_feedback ADD CONSTRAINT project_feedback_areas_range CHECK (
  (rating_communication IS NULL OR rating_communication BETWEEN 1 AND 5) AND
  (rating_quality IS NULL OR rating_quality BETWEEN 1 AND 5) AND
  (rating_on_time IS NULL OR rating_on_time BETWEEN 1 AND 5) AND
  (rating_value IS NULL OR rating_value BETWEEN 1 AND 5) AND
  (rating_pm_support IS NULL OR rating_pm_support BETWEEN 1 AND 5)
);
ALTER TABLE project_feedback DROP CONSTRAINT IF EXISTS project_feedback_recommend_check;
ALTER TABLE project_feedback ADD CONSTRAINT project_feedback_recommend_check
  CHECK (would_recommend IS NULL OR would_recommend IN ('yes', 'maybe', 'no'));

COMMIT;
