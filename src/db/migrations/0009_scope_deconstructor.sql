-- migration: 0009_scope_deconstructor.sql

ALTER TABLE "agency_project" ADD COLUMN "source_brief" TEXT;
