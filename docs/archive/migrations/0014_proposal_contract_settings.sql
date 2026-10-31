-- Add contractSettings JSONB column to proposal table for optional contract fields
ALTER TABLE "proposal" ADD COLUMN IF NOT EXISTS "contractSettings" jsonb DEFAULT '{}'::jsonb;
