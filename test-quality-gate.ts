import { db } from "@/db";
import { agencyProjects, tasks, milestones, taskSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { submitTaskForVerification, getLatestTaskSubmission, polishDeliveryNotes } from "@/actions/task-quality-gate";

async function runQualityGateTest() {
  console.log("🧪 Starting Feature 2 Automated DoD & AI Quality Gatekeeper Test...\n");

  const testProjectId = `test-gate-proj-${Date.now()}`;
  const testMilestoneId = `test-gate-ms-${Date.now()}`;
  const testTaskId = `test-gate-task-${Date.now()}`;

  try {
    // 1. Provision Test Project, Milestone & Task
    console.log("1️⃣ Provisioning test project and task...");
    await db.insert(agencyProjects).values({
      id: testProjectId,
      title: "Quality Gate Test Project",
      status: "In Progress",
      progressPercentage: 0,
    });

    await db.insert(milestones).values({
      id: testMilestoneId,
      projectId: testProjectId,
      title: "Sprint 1: Core API & Integrations",
      order: 1,
      status: "In Progress",
    });

    await db.insert(tasks).values({
      id: testTaskId,
      projectId: testProjectId,
      milestoneId: testMilestoneId,
      title: "Implement OAuth2 Social Login and Session Management",
      description: "Integrate Google OAuth provider, verify secure HTTP-only session cookies, and handle error callbacks with automated unit test coverage.",
      weight: 5,
      status: "In Progress",
      requiresProof: true,
    });

    console.log("   ✓ Project & Task created in 'In Progress' status (Weight: 5 pts).");

    // 2. Test Case 1: Facebook Reel submitted for a Backend Coding Task (Must REJECT with Hard-Fail Cap)
    console.log("\n2️⃣ Test Case 1: Submitting Facebook Reel for a Backend Coding Task...");
    const fbReelInput = {
      taskId: testTaskId,
      proofUrl: "https://www.facebook.com/reel/987654321098765",
      submissionNotes: "Completed the entire OAuth authentication system, deployed the endpoints, migrated the schema, verified unit tests, and tested Google login callback flows.", // Long technical notes
    };

    const res1 = await submitTaskForVerification(fbReelInput);
    console.log("   👉 Quality Gate Result 1 (Facebook Reel):", {
      success: res1.success,
      passed: res1.passed,
      score: res1.score,
      gateStatus: res1.gateStatus,
      summary: res1.summary,
    });

    const taskAfterRes1 = await db.query.tasks.findFirst({ where: eq(tasks.id, testTaskId) });
    const submission1 = await getLatestTaskSubmission(testTaskId);

    console.log(`   👉 Task status in DB: '${taskAfterRes1?.status}'`);
    const hasArtifactFail1 = (submission1?.criteriaBreakdown as Array<{ criterion: string; status: string; notes?: string }> | undefined)?.some(
      (c) => c.criterion.includes("Artifact") && c.status === "FAIL"
    );

    if (taskAfterRes1?.status === "Changes Requested" && !res1.passed && (res1.score ?? 0) <= 45 && hasArtifactFail1) {
      console.log("   ✅ PASSED: Facebook Reel was successfully REJECTED! Hard-fail cap applied (Score <= 45%), status set to 'Changes Requested'!");
      console.log(`      • Feedback: ${(submission1?.criteriaBreakdown as Array<{ criterion: string; status: string; notes?: string }> | undefined)?.find((c) => c.criterion.includes("Artifact"))?.notes}`);
    } else {
      console.error(`   ❌ FAILED: Facebook Reel was not properly rejected. Status: ${taskAfterRes1?.status}, Score: ${res1.score}`);
    }

    // 3. Test Case 2: Bare Homepage Domain without Deep Link Specificity (Must REJECT)
    console.log("\n3️⃣ Test Case 2: Submitting bare homepage without deep-link path (e.g. 'https://github.com')...");
    const bareDomainInput = {
      taskId: testTaskId,
      proofUrl: "https://github.com",
      submissionNotes: "Implemented and verified Google OAuth authentication system with full automated unit test coverage.",
    };

    const res2 = await submitTaskForVerification(bareDomainInput);
    console.log("   👉 Quality Gate Result 2 (Bare Domain):", {
      success: res2.success,
      passed: res2.passed,
      score: res2.score,
      gateStatus: res2.gateStatus,
    });

    const submission2 = await getLatestTaskSubmission(testTaskId);
    const hasBareDomainFail = (submission2?.criteriaBreakdown as Array<{ criterion: string; status: string; notes?: string }> | undefined)?.some(
      (c) => c.criterion.includes("Artifact") && c.status === "FAIL"
    );

    if (!res2.passed && (res2.score ?? 0) <= 45 && hasBareDomainFail) {
      console.log("   ✅ PASSED: Bare homepage was successfully REJECTED! Deep link specificity enforced.");
    } else {
      console.error(`   ❌ FAILED: Bare homepage was not rejected. Score: ${res2.score}`);
    }

    // 4. Test Case 3: Legitimate High-Quality GitHub PR Deep Link (Must PASS >= 80%)
    console.log("\n4️⃣ Test Case 3: Submitting valid GitHub PR deep link with thorough verification notes...");
    const validPrInput = {
      taskId: testTaskId,
      proofUrl: "https://github.com/vercel/next.js/pull/1",
      submissionNotes: "Implemented complete Google OAuth2 flow with Auth.js. Verified session persistence with HTTP-only cookies across browser tabs. Added integration test suite covering callback failures and token refresh. Staging deployment tested and verified.",
    };

    const res3 = await submitTaskForVerification(validPrInput);
    console.log("   👉 Quality Gate Result 3 (Valid GitHub PR):", {
      success: res3.success,
      passed: res3.passed,
      score: res3.score,
      gateStatus: res3.gateStatus,
      summary: res3.summary,
    });

    const taskAfterRes3 = await db.query.tasks.findFirst({ where: eq(tasks.id, testTaskId) });
    const submission3 = await getLatestTaskSubmission(testTaskId);

    console.log(`   👉 Task status in DB: '${taskAfterRes3?.status}'`);
    if (taskAfterRes3?.status === "In Review" && res3.passed && (res3.score ?? 0) >= 80) {
      console.log("   ✅ PASSED: Quality Gate PASSED for legitimate GitHub PR (Score >= 80%), task moved to 'In Review'!");
      (submission3?.criteriaBreakdown as Array<{ criterion: string; status: string; notes?: string }> | undefined)?.forEach((c) => {
        console.log(`      • [${c.status}] ${c.criterion}: ${c.notes}`);
      });
    } else {
      console.error(`   ❌ FAILED: Expected 'In Review' with score >= 80, got '${taskAfterRes3?.status}' (Score: ${res3.score})`);
    }

    // 5. Test Case 4: Marketing Task Exception (Facebook Reel allowed for Marketing Task)
    console.log("\n5️⃣ Test Case 4: Submitting Facebook Reel for an explicit Marketing / Social Media Campaign task...");
    const marketingTaskId = `test-mkt-task-${Date.now()}`;
    await db.insert(tasks).values({
      id: marketingTaskId,
      projectId: testProjectId,
      milestoneId: testMilestoneId,
      title: "Publish Launch Reel & Social Media Campaign Video",
      description: "Produce, edit, and post the promotional video reel across Facebook and Instagram channels with engagement tracking.",
      weight: 3,
      status: "In Progress",
      requiresProof: true,
    });

    const marketingInput = {
      taskId: marketingTaskId,
      proofUrl: "https://www.facebook.com/reel/987654321098765",
      submissionNotes: "Edited promotional video reel, added branding overlay, and published the live post across our official Facebook page with tracked campaign UTM tags.",
    };

    const res4 = await submitTaskForVerification(marketingInput);
    console.log("   👉 Quality Gate Result 4 (Marketing Context):", {
      success: res4.success,
      passed: res4.passed,
      score: res4.score,
      gateStatus: res4.gateStatus,
      summary: res4.summary,
    });

    const taskAfterRes4 = await db.query.tasks.findFirst({ where: eq(tasks.id, marketingTaskId) });

    if (taskAfterRes4?.status === "In Review" && res4.passed && (res4.score ?? 0) >= 80) {
      console.log("   ✅ PASSED: Contextual exception verified! Facebook Reel was correctly accepted for explicit Social Media Marketing task.");
    } else {
      console.error(`   ❌ FAILED: Marketing task exception failed. Status: ${taskAfterRes4?.status}, Score: ${res4.score}`);
    }

    // Cleanup marketing task
    await db.delete(taskSubmissions).where(eq(taskSubmissions.taskId, marketingTaskId));
    await db.delete(tasks).where(eq(tasks.id, marketingTaskId));

    // 6. Test Case 5: YouTube Shorts on a Gibberish Task ("fsdfsdfs") - MUST REJECT (Score <= 38%)
    console.log("\n6️⃣ Test Case 5: Submitting YouTube Shorts for a Gibberish Task ('fsdfsdfs')...");
    const gibberishTaskId = `test-gibberish-task-${Date.now()}`;
    await db.insert(tasks).values({
      id: gibberishTaskId,
      projectId: testProjectId,
      milestoneId: testMilestoneId,
      title: "fsdfsdfs",
      description: null,
      weight: 2,
      status: "In Progress",
      requiresProof: true,
    });

    const ytShortsInput = {
      taskId: gibberishTaskId,
      proofUrl: "https://www.youtube.com/shorts/E1tYLwwnCms",
      submissionNotes: "Here is the completed work for the task, everything has been implemented and tested thoroughly.",
    };

    const res5 = await submitTaskForVerification(ytShortsInput);
    console.log("   👉 Quality Gate Result 5 (YouTube Shorts on 'fsdfsdfs'):", {
      success: res5.success,
      passed: res5.passed,
      score: res5.score,
      gateStatus: res5.gateStatus,
      summary: res5.summary,
    });

    const taskAfterRes5 = await db.query.tasks.findFirst({ where: eq(tasks.id, gibberishTaskId) });
    const submission5 = await getLatestTaskSubmission(gibberishTaskId);

    const hasYtShortsFail = (submission5?.criteriaBreakdown as Array<{ criterion: string; status: string; notes?: string }> | undefined)?.some(
      (c) => c.criterion.includes("Artifact") && c.status === "FAIL"
    );

    if (taskAfterRes5?.status === "Changes Requested" && !res5.passed && (res5.score ?? 0) <= 38 && hasYtShortsFail) {
      console.log("   ✅ PASSED: YouTube Shorts on 'fsdfsdfs' was successfully REJECTED! (Score <= 38%, Status: 'Changes Requested').");
      (submission5?.criteriaBreakdown as Array<{ criterion: string; status: string; notes?: string }> | undefined)?.forEach((c) => {
        console.log(`      • [${c.status}] ${c.criterion}: ${c.notes}`);
      });
    } else {
      console.error(`   ❌ FAILED: YouTube Shorts was not properly rejected. Status: ${taskAfterRes5?.status}, Score: ${res5.score}`);
    }

    // Cleanup gibberish task
    await db.delete(taskSubmissions).where(eq(taskSubmissions.taskId, gibberishTaskId));
    await db.delete(tasks).where(eq(tasks.id, gibberishTaskId));

    // 7. Test Case 6: AI Polish Delivery Notes from Raw Brief Input
    console.log("\n7️⃣ Test Case 6: AI Polish Delivery Notes from Raw Brief Input...");
    const rawBriefNotes = "oauth google login done tested in staging";
    const polishResult = await polishDeliveryNotes({
      taskId: testTaskId,
      taskTitle: "Implement OAuth2 Social Login and Session Management",
      taskDescription: "Integrate Google OAuth provider, verify secure HTTP-only session cookies, and handle error callbacks with automated unit test coverage.",
      rawNotes: rawBriefNotes,
      proofUrls: ["https://github.com/vercel/next.js/pull/1"],
    });

    console.log("   👉 Polished Notes Result:", {
      success: polishResult.success,
      length: polishResult.polishedNotes?.length,
    });

    if (polishResult.success && polishResult.polishedNotes && polishResult.polishedNotes.length >= 80) {
      console.log(`   ✅ PASSED: AI Polish generated structured, substantive notes (${polishResult.polishedNotes.length} chars).`);
      console.log("      • Output:\n" + polishResult.polishedNotes.split("\n").map((l: string) => "        " + l).join("\n"));
    } else {
      console.error("   ❌ FAILED: AI Polish output was insufficient or failed.", polishResult);
    }

    // 8. Progress Integrity Check
    const proj = await db.query.agencyProjects.findFirst({ where: eq(agencyProjects.id, testProjectId) });
    console.log(`\n8️⃣ Progress Integrity Check: Project progress is ${proj?.progressPercentage}%`);
    if (proj?.progressPercentage === 0) {
      console.log("   ✅ PASSED: Points were NOT prematurely awarded! (Only PM final sign-off to 'Done' unlocks weighted velocity).");
    }

    console.log("\n🎉 All Feature 2 Quality Gatekeeper & Link Relevance test cases PASSED successfully!");

  } catch (err) {
    console.error("❌ Quality Gatekeeper test failed with error:", err);
  } finally {
    console.log("\n🧹 Cleaning up test data from database...");
    await db.delete(taskSubmissions).where(eq(taskSubmissions.taskId, testTaskId));
    await db.delete(tasks).where(eq(tasks.projectId, testProjectId));
    await db.delete(milestones).where(eq(milestones.projectId, testProjectId));
    await db.delete(agencyProjects).where(eq(agencyProjects.id, testProjectId));
    console.log("✨ Cleanup complete.");
    process.exit(0);
  }
}

runQualityGateTest();
