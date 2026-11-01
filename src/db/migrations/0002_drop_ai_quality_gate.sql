ALTER TABLE "task_submission" DROP COLUMN "ai_confidence_score";--> statement-breakpoint
ALTER TABLE "task_submission" DROP COLUMN "gate_status";--> statement-breakpoint
ALTER TABLE "task_submission" DROP COLUMN "ai_summary";--> statement-breakpoint
ALTER TABLE "task_submission" DROP COLUMN "criteria_breakdown";--> statement-breakpoint
DROP TYPE "public"."quality_gate_status";