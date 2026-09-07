"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

const ProgressResponseSchema = z.object({
  totalWeight: z.number(),
  completedWeight: z.number(),
  percentage: z.number(),
});

export type ProjectProgress = z.infer<typeof ProgressResponseSchema>;

export async function getProjectProgress(projectId: string): Promise<ProjectProgress> {
  const result = await db.execute(
    sql`SELECT get_project_progress(${projectId}) AS progress`
  );

  const rawData = result.rows[0]?.progress;
  const parsed = ProgressResponseSchema.safeParse(rawData);

  if (!parsed.success) {
    return { totalWeight: 0, completedWeight: 0, percentage: 0 };
  }

  return parsed.data;
}
