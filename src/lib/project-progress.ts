import { db } from "@/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

// No access check here on purpose: this is the plain query, kept out of any "use server" file so it is
// not a public endpoint. The server action in src/actions/progress.ts checks access, and the tsx test
// script (tests/test-progress.ts) uses this directly because it runs without a session.

const ProgressResponseSchema = z.object({
  totalWeight: z.number(),
  completedWeight: z.number(),
  percentage: z.number(),
});

export type ProjectProgress = z.infer<typeof ProgressResponseSchema>;

export async function fetchProjectProgress(projectId: string): Promise<ProjectProgress> {
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
