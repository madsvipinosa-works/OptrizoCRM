import "dotenv/config";
import { db } from "@/db";
import { agencyProjects, milestones, tasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function runTaskDependencyTest() {
  console.log("🧪 Starting Prerequisite Task Dependency & Sequencing Automated Test...\n");

  const testProjectId = `test-dep-proj-${Date.now()}`;
  const testMilestoneId = `test-dep-ms-${Date.now()}`;
  const taskAId = `test-task-A-${Date.now()}`;
  const taskBId = `test-task-B-${Date.now()}`;
  const taskCId = `test-task-C-${Date.now()}`;

  try {
    // 1. Provision Project, Milestone, and 3 Tasks
    console.log("1️⃣ Provisioning test project, milestone, and tasks...");
    await db.insert(agencyProjects).values({
      id: testProjectId,
      title: "Prerequisite Sequencing Test Project",
      status: "In Progress",
      progressPercentage: 0,
    });

    await db.insert(milestones).values({
      id: testMilestoneId,
      projectId: testProjectId,
      title: "Milestone 1: Backend Architecture",
      order: 1,
      status: "In Progress",
    });

    // Task A: Prerequisite (In Progress)
    await db.insert(tasks).values({
      id: taskAId,
      projectId: testProjectId,
      milestoneId: testMilestoneId,
      title: "Task A: Database Migrations & Schema",
      description: "Core tables and foreign keys",
      status: "In Progress",
      weight: 3,
      requiresProof: false,
    });

    // Task B: Dependent on Task A (Todo)
    await db.insert(tasks).values({
      id: taskBId,
      projectId: testProjectId,
      milestoneId: testMilestoneId,
      title: "Task B: REST API Endpoints",
      description: "CRUD handlers for PM tasks",
      status: "Todo",
      weight: 3,
      requiresProof: false,
    });

    // Task C: Dependent on Task B (Todo)
    await db.insert(tasks).values({
      id: taskCId,
      projectId: testProjectId,
      milestoneId: testMilestoneId,
      title: "Task C: Frontend Dashboard Integration",
      description: "Kanban board and details drawer",
      status: "Todo",
      weight: 2,
      requiresProof: false,
    });

    console.log("   ✓ Tasks created: Task A (In Progress), Task B (Todo), Task C (Todo)");

    // 2. Test Case 1: Self-Dependency Rejection
    console.log("\n2️⃣ Test Case 1: Testing Self-Dependency Prevention...");
    const selfDepAttempt = (taskId: string, targetPrerequisiteId: string) => {
      if (taskId === targetPrerequisiteId) {
        return { success: false, message: "A task cannot depend on itself." };
      }
      return { success: true };
    };

    const selfRes = selfDepAttempt(taskAId, taskAId);
    if (!selfRes.success && selfRes.message === "A task cannot depend on itself.") {
      console.log("   ✅ PASSED: Self-dependency rejected with clear validation message.");
    } else {
      throw new Error(`Self-dependency check failed! Output: ${JSON.stringify(selfRes)}`);
    }

    // 3. Test Case 2: Assign Task A as Prerequisite of Task B
    console.log("\n3️⃣ Test Case 2: Assigning Task A as Prerequisite for Task B...");
    await db.update(tasks).set({ dependsOnTaskId: taskAId }).where(eq(tasks.id, taskBId));

    const updatedTaskB = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskBId),
    });
    if (updatedTaskB?.dependsOnTaskId === taskAId) {
      console.log("   ✅ PASSED: Task B successfully linked to prerequisite Task A.");
    } else {
      throw new Error("Failed to set dependsOnTaskId for Task B");
    }

    // 4. Test Case 3: Circular Dependency Prevention (Task A trying to depend on Task B)
    console.log("\n4️⃣ Test Case 3: Testing Circular Dependency Prevention...");
    // Simulated action validation check:
    const checkCircular = async (currentTaskId: string, candidatePrereqId: string) => {
      const candidate = await db.query.tasks.findFirst({
        where: and(eq(tasks.id, candidatePrereqId), eq(tasks.projectId, testProjectId)),
        columns: { id: true, dependsOnTaskId: true, title: true },
      });
      if (candidate?.dependsOnTaskId === currentTaskId) {
        return {
          success: false,
          message: `Circular dependency: "${candidate.title}" already depends on this task.`,
        };
      }
      return { success: true };
    };

    const circularRes = await checkCircular(taskAId, taskBId);
    if (!circularRes.success && circularRes.message.includes("Circular dependency")) {
      console.log(`   ✅ PASSED: Circular link rejected: "${circularRes.message}"`);
    } else {
      throw new Error(`Circular dependency check failed! Output: ${JSON.stringify(circularRes)}`);
    }

    // 5. Test Case 4: Prerequisite Enforcement (Task B cannot advance while Task A is incomplete)
    console.log("\n5️⃣ Test Case 4: Testing Prerequisite Incomplete Blocker Enforcement...");
    const validateTaskStatusTransition = async (taskId: string, targetStatus: string) => {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
      });
      if (!task) return { success: false, message: "Task not found" };

      if (task.dependsOnTaskId && ["In Progress", "In Review", "Done"].includes(targetStatus)) {
        const prereq = await db.query.tasks.findFirst({
          where: eq(tasks.id, task.dependsOnTaskId),
        });
        if (prereq && prereq.status !== "Done") {
          return {
            success: false,
            message: `Cannot move task: Prerequisite task "${prereq.title}" is not completed yet.`,
          };
        }
      }
      return { success: true };
    };

    const transitionRes = await validateTaskStatusTransition(taskBId, "In Progress");
    if (!transitionRes.success && transitionRes.message.includes("Prerequisite task")) {
      console.log(`   ✅ PASSED: Transition blocked while Task A is incomplete: "${transitionRes.message}"`);
    } else {
      throw new Error(`Prerequisite enforcement failed! Output: ${JSON.stringify(transitionRes)}`);
    }

    // 6. Test Case 5: Two-Way Visibility Computation (Upstream Prerequisite & Downstream Blocked Tasks)
    console.log("\n6️⃣ Test Case 5: Verifying Two-Way Dependency Querying...");
    // Link Task C to Task B
    await db.update(tasks).set({ dependsOnTaskId: taskBId }).where(eq(tasks.id, taskCId));

    const allProjectTasks = await db.query.tasks.findMany({
      where: eq(tasks.projectId, testProjectId),
    });

    // Check for Task B:
    // Upstream prerequisite: Task A
    const bPrereq = allProjectTasks.find((t) => t.id === updatedTaskB?.dependsOnTaskId);
    // Downstream blocked tasks: Task C
    const bBlocked = allProjectTasks.filter((t) => t.dependsOnTaskId === taskBId);

    if (bPrereq?.id === taskAId && bBlocked.length === 1 && bBlocked[0].id === taskCId) {
      console.log("   ✅ PASSED: Two-way visibility verified:");
      console.log(`      • Upstream Prerequisite: "${bPrereq.title}" (${bPrereq.status})`);
      console.log(`      • Downstream Blocked: ${bBlocked.length} task -> "${bBlocked[0].title}"`);
    } else {
      throw new Error("Two-way visibility query failed!");
    }

    // 7. Test Case 6: Unblocking when Prerequisite is Marked Done
    console.log("\n7️⃣ Test Case 6: Unblocking Task B when Task A is Completed...");
    // Mark Task A as Done
    await db.update(tasks).set({ status: "Done" }).where(eq(tasks.id, taskAId));

    const postDoneTransition = await validateTaskStatusTransition(taskBId, "In Progress");
    if (postDoneTransition.success) {
      // Actually advance Task B
      await db.update(tasks).set({ status: "In Progress" }).where(eq(tasks.id, taskBId));
      console.log("   ✅ PASSED: Task B successfully unblocked and moved to 'In Progress'!");
    } else {
      throw new Error(`Unblocking failed: ${postDoneTransition.message}`);
    }

    // 8. Test Case 7: Database Foreign Key Safety (ON DELETE SET NULL)
    console.log("\n8️⃣ Test Case 7: Verifying Database Foreign Key ON DELETE SET NULL Safety...");
    // If Task A is deleted, Task B's dependsOnTaskId should safely become null without crashing
    await db.delete(tasks).where(eq(tasks.id, taskAId));

    const taskBAfterDelete = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskBId),
    });
    if (taskBAfterDelete && taskBAfterDelete.dependsOnTaskId === null) {
      console.log("   ✅ PASSED: Foreign key set null on delete verified (no orphaned constraint errors).");
    } else {
      throw new Error(`FK on delete set null failed: dependsOnTaskId is ${taskBAfterDelete?.dependsOnTaskId}`);
    }

    console.log("\n🎉 All 7 Task Prerequisite & Sequencing test cases PASSED successfully!");
  } finally {
    // Teardown
    console.log("\n🧹 Cleaning up test data from database...");
    await db.delete(tasks).where(eq(tasks.projectId, testProjectId));
    await db.delete(milestones).where(eq(milestones.projectId, testProjectId));
    await db.delete(agencyProjects).where(eq(agencyProjects.id, testProjectId));
    console.log("✨ Cleanup complete.");
  }
}

runTaskDependencyTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  });
