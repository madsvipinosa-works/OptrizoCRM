"use server";

import { authorizeProject } from "@/lib/authz";
import { fetchProjectProgress, type ProjectProgress } from "@/lib/project-progress";

export async function getProjectProgress(projectId: string): Promise<ProjectProgress> {
  // A zero result would look like real progress, so a refused caller gets an error instead.
  const access = await authorizeProject(projectId, "read");
  if (!access.ok) {
    throw new Error("Unauthorized");
  }

  return fetchProjectProgress(projectId);
}
