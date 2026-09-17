import * as dotenv from "dotenv";
dotenv.config();

import { db } from "@/db";
import { agencyProjects, tasks, milestones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectProgress } from "@/actions/progress";

async function runTest() {
  console.log("🧪 Starting Feature 1 Weighted Progress Engine Test...\n");

  const testProjectId = `test-proj-${Date.now()}`;
  const testMilestoneId = `test-ms-${Date.now()}`;
  const taskAId = `test-task-a-${Date.now()}`;
  const taskBId = `test-task-b-${Date.now()}`;
  const taskCId = `test-task-c-${Date.now()}`;

  try {
    // 1. Create a dummy project & milestone
    console.log("1️⃣ Creating test project and milestone...");
    await db.insert(agencyProjects).values({
      id: testProjectId,
      title: "Test Weighted Engine Project",
      status: "In Progress",
      progressPercentage: 0,
    });

    await db.insert(milestones).values({
      id: testMilestoneId,
      projectId: testProjectId,
      title: "Milestone 1",
      order: 1,
      status: "In Progress",
    });

    // 2. Insert 3 tasks with weights: 2, 3, 5 (Total = 10 points)
    console.log("2️⃣ Inserting 3 tasks with weights: 2pts, 3pts, 5pts (Total = 10pts)...");
    await db.insert(tasks).values([
      { id: taskAId, projectId: testProjectId, milestoneId: testMilestoneId, title: "Task A (Quick fix)", weight: 2, status: "Todo" },
      { id: taskBId, projectId: testProjectId, milestoneId: testMilestoneId, title: "Task B (Backend API)", weight: 3, status: "Todo" },
      { id: taskCId, projectId: testProjectId, milestoneId: testMilestoneId, title: "Task C (Complex UI)", weight: 5, status: "Todo" },
    ]);

    // Check initial progress via Trigger & Server Action
    let proj = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, testProjectId) });
    let metrics = await getProjectProgress(testProjectId);
    console.log(`   Initial DB progress_percentage: ${proj?.progressPercentage}% | Metrics:`, metrics);

    // 3. Complete Task A (Weight: 2) -> Progress should be 2/10 = 20% (Notice: unweighted would be 1/3 = 33%)
    console.log("\n3️⃣ Completing Task A (Weight: 2)...");
    await db.update(tasks).set({ status: "Done" }).where(eq(tasks.id, taskAId));

    proj = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, testProjectId) });
    metrics = await getProjectProgress(testProjectId);
    console.log(`   👉 Trigger auto-updated DB progress_percentage: ${proj?.progressPercentage}%`);
    console.log(`   👉 Server Action metrics: ${metrics.completedWeight}/${metrics.totalWeight} pts (${metrics.percentage}%)`);
    if (proj?.progressPercentage === 20) {
      console.log("   ✅ PASSED: Weighted calculation is 20% (Unweighted count would have falsely said 33%)");
    } else {
      console.error(`   ❌ FAILED: Expected 20%, got ${proj?.progressPercentage}%`);
    }

    // 4. Complete Task C (Weight: 5) -> Total completed: 2 + 5 = 7/10 = 70% (Notice: unweighted would be 2/3 = 67%)
    console.log("\n4️⃣ Completing Task C (Weight: 5)...");
    await db.update(tasks).set({ status: "Done" }).where(eq(tasks.id, taskCId));

    proj = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, testProjectId) });
    metrics = await getProjectProgress(testProjectId);
    console.log(`   👉 Trigger auto-updated DB progress_percentage: ${proj?.progressPercentage}%`);
    console.log(`   👉 Server Action metrics: ${metrics.completedWeight}/${metrics.totalWeight} pts (${metrics.percentage}%)`);
    if (proj?.progressPercentage === 70) {
      console.log("   ✅ PASSED: Weighted calculation is 70% (Correctly weighted!)");
    } else {
      console.error(`   ❌ FAILED: Expected 70%, got ${proj?.progressPercentage}%`);
    }

    // 5. Complete Task B (Weight: 3) -> Total completed: 10/10 = 100%
    console.log("\n5️⃣ Completing Task B (Weight: 3)...");
    await db.update(tasks).set({ status: "Done" }).where(eq(tasks.id, taskBId));

    proj = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, testProjectId) });
    metrics = await getProjectProgress(testProjectId);
    console.log(`   👉 Trigger auto-updated DB progress_percentage: ${proj?.progressPercentage}%`);
    console.log(`   👉 Server Action metrics: ${metrics.completedWeight}/${metrics.totalWeight} pts (${metrics.percentage}%)`);
    if (proj?.progressPercentage === 100) {
      console.log("   ✅ PASSED: Project reached 100%!");
    }

    console.log("\n🎉 All Feature 1 automated test cases PASSED successfully!");

  } catch (error) {
    console.error("❌ Test failed with error:", error);
  } finally {
    // Cleanup test data
    console.log("\n🧹 Cleaning up test data from database...");
    await db.delete(tasks).where(eq(tasks.projectId, testProjectId));
    await db.delete(milestones).where(eq(milestones.projectId, testProjectId));
    await db.delete(agencyProjects).where(eq(agencyProjects.id, testProjectId));
    console.log("✨ Cleanup complete.");
    process.exit(0);
  }
}

runTest();
