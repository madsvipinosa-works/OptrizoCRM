import "dotenv/config";
import { db } from "@/db";
import { agencyProjects, projectTeamMembers, taskAssignees, tasks, users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";

async function main() {
    console.log("Backfilling project team members from task assignees...");

    const existingAssignments = await db
        .select({
            projectId: tasks.projectId,
            userId: taskAssignees.userId,
        })
        .from(taskAssignees)
        .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
        .innerJoin(agencyProjects, eq(tasks.projectId, agencyProjects.id))
        .innerJoin(users, eq(taskAssignees.userId, users.id))
        .where(and(eq(agencyProjects.isArchived, false), ne(users.role, "client")));

    const uniquePairs = Array.from(
        new Map(
            existingAssignments.map((row) => [`${row.projectId}:${row.userId}`, row])
        ).values()
    );

    if (uniquePairs.length === 0) {
        console.log("No task-assignee pairs found for active projects.");
        process.exit(0);
    }

    await db
        .insert(projectTeamMembers)
        .values(
            uniquePairs.map((row) => ({
                projectId: row.projectId,
                userId: row.userId,
                isAssignable: true,
            }))
        )
        .onConflictDoNothing();

    console.log(`Backfill complete. Processed ${uniquePairs.length} project-user pairs.`);
    process.exit(0);
}

main();
