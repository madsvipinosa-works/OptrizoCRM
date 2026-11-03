BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('bank_transfer','gcash','cheque','cash'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='account_status') THEN
    CREATE TYPE account_status AS ENUM ('invited','active','locked','deactivated'); END IF;
END $$;
-- accounts: existing users stay active; only new self sign-ups are inserted as 'invited'
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS status account_status NOT NULL DEFAULT 'active';
-- payments
ALTER TABLE payment ADD COLUMN IF NOT EXISTS method payment_method;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS reference_no text;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS or_number text;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS proof_file_url text;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS proof_uploaded_at timestamptz;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS proof_rejected_reason text;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS confirmed_by text REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_or_number ON payment (or_number) WHERE or_number IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payment_paid_fields_check') THEN
    ALTER TABLE payment ADD CONSTRAINT payment_paid_fields_check CHECK (
      status <> 'paid' OR (method IS NOT NULL AND received_at IS NOT NULL AND or_number IS NOT NULL
                           AND (method = 'cash' OR reference_no IS NOT NULL)));
  END IF;
END $$;
-- project completion
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS signed_off_by text REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS signed_off_at timestamptz;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS sign_off_file_url text;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE agency_project ADD COLUMN IF NOT EXISTS warranty_ends_at timestamptz;
-- handover files (spec s3 `documents`, handover type only this session)
CREATE TABLE IF NOT EXISTS document (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES agency_project(id) ON DELETE CASCADE,
  client_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('handover')),
  title text NOT NULL,
  file_url text NOT NULL,
  uploaded_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_document_project ON document (project_id);
CREATE INDEX IF NOT EXISTS idx_document_client ON document (client_user_id);
-- client feedback at step 31
CREATE TABLE IF NOT EXISTS project_feedback (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES agency_project(id) ON DELETE CASCADE,
  client_id text REFERENCES "user"(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_feedback_one ON project_feedback (project_id, client_id);
-- new tables: RLS on, no policies (the app connects with the owner role; anon/PostgREST gets nothing)
ALTER TABLE document ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_feedback ENABLE ROW LEVEL SECURITY;
COMMIT;
