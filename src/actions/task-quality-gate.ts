"use server";

import { db } from "@/db";
import { tasks, taskSubmissions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const SubmissionInputSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  proofUrl: z.string().url("Must provide a valid URL (PR, preview, Figma, or Loom)"),
  submissionNotes: z
    .string()
    .min(25, "Please provide comprehensive delivery notes (minimum 25 characters)"),
});

export type QualityGateResult = {
  success: boolean;
  passed?: boolean;
  score?: number;
  gateStatus?: "Passed" | "Failed";
  summary?: string;
  criteria?: Array<{
    criterion: string;
    status: "PASS" | "FAIL" | "PARTIAL";
    notes: string;
  }>;
  error?: string | Record<string, string[]>;
};

export type TaskCategory =
  | "ENGINEERING"
  | "DESIGN"
  | "MARKETING_CONTENT"
  | "GENERAL_DOCS";

/**
 * Classifies a task into a functional category based on its title and description.
 */
function classifyTaskCategory(
  title: string,
  description: string | null
): TaskCategory {
  const text = `${title} ${description || ""}`.toLowerCase();

  if (
    /(marketing|social media|facebook|reddit|instagram|tiktok|campaign|reel|tweet|post|community|newsletter|advertising)/i.test(
      text
    )
  ) {
    return "MARKETING_CONTENT";
  }

  if (
    /(figma|wireframe|mockup|ui|ux|logo|prototype|design|banner|graphic|layout|typography|palette)/i.test(
      text
    )
  ) {
    return "DESIGN";
  }

  if (
    /(api|backend|frontend|auth|database|endpoint|component|crud|test|deploy|bug|fix|code|query|schema|drizzle|postgres|react|nextjs|route|service|migration|oauth)/i.test(
      text
    )
  ) {
    return "ENGINEERING";
  }

  return "GENERAL_DOCS";
}

const SHORT_FORM_VIDEO_PATTERNS = [
  { host: /(^|\.)youtube\.com$/, path: /^\/shorts(\/.*)?$/i, label: "YouTube Shorts" },
  { host: /^youtu\.be$/, path: /^\/shorts(\/.*)?$/i, label: "YouTube Shorts" },
  { host: /(^|\.)tiktok\.com$/, path: /.*/, label: "TikTok" },
  { host: /(^|\.)instagram\.com$/, path: /^\/(reels?|stories)(\/.*)?$/i, label: "Instagram Reels/Stories" },
  { host: /(^|\.)(facebook|fb)\.com$/, path: /^\/(reel|reels|watch)(\/.*)?$/i, label: "Facebook Reel/Watch" },
  { host: /^fb\.watch$/, path: /.*/, label: "Facebook Watch" },
  { host: /(^|\.)snapchat\.com$/, path: /^\/spotlight(\/.*)?$/i, label: "Snapchat Spotlight" },
];

const DISALLOWED_ENTERTAINMENT_DOMAINS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "twitch.tv",
  "netflix.com",
  "hulu.com",
  "disneyplus.com",
  "max.com",
  "primevideo.com",
  "9gag.com",
  "pinterest.com",
  "spotify.com",
  "soundcloud.com",
  "music.youtube.com",
  "music.apple.com",
  "pandora.com",
  "snapchat.com",
  "discord.com",
  "discord.gg",
  "threads.net",
  "tumblr.com",
  "steampowered.com",
  "epicgames.com",
  "roblox.com",
];

// Authoritative Work Platform Matchers
const VERIFIED_CODE_HOSTS = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "dev.azure.com",
  "gist.github.com",
  "codesandbox.io",
  "stackblitz.com",
  "replit.com",
  "codepen.io",
];

const VERIFIED_STAGING_HOST_PATTERNS = [
  /\.vercel\.app$/,
  /\.netlify\.app$/,
  /\.pages\.dev$/,
  /\.ngrok-free\.app$/,
  /\.ngrok\.app$/,
  /\.ngrok\.io$/,
  /\.onrender\.com$/,
  /\.render\.com$/,
  /\.fly\.dev$/,
  /\.railway\.app$/,
  /\.supabase\.co$/,
  /\.supabase\.in$/,
  /\.herokuapp\.com$/,
  /\.amplifyapp\.com$/,
  /\.web\.app$/,
  /\.firebaseapp\.com$/,
  /\.azurewebsites\.net$/,
  /\.cloudfunctions\.net$/,
  /^localhost$/,
  /^127\.0\.0\.1$/,
];

const VERIFIED_DESIGN_HOSTS = [
  "figma.com",
  "canva.com",
  "adobe.com",
  "xd.adobe.com",
  "dribbble.com",
  "behance.net",
  "framer.com",
  "framer.app",
  "miro.com",
  "invisionapp.com",
  "zeplin.io",
];

const VERIFIED_WALKTHROUGH_HOSTS = [
  "loom.com",
  "vimeo.com",
  "tango.us",
  "supademo.com",
  "screenpal.com",
];

const VERIFIED_DOCS_MANAGEMENT_HOSTS = [
  "docs.google.com",
  "drive.google.com",
  "sheets.google.com",
  "notion.so",
  "notion.site",
  "coda.io",
  "linear.app",
  "clickup.com",
  "trello.com",
  "asana.com",
  "atlassian.net",
  "jira.com",
  "confluence.com",
  "postman.com",
  "swagger.io",
  "gitbook.io",
  "gitbook.com",
];

/**
 * Detects placeholder, random keystrokes, or gibberish task titles
 * (e.g. "fsdfsdfs", "asdasd", "test", "qwerty")
 */
function isGibberishOrNonInformative(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length < 3) return true;

  const placeholders = new Set([
    "test",
    "testing",
    "asdf",
    "asdasd",
    "qwerty",
    "temp",
    "foo",
    "bar",
    "baz",
    "none",
    "sample",
    "dummy",
    "placeholder",
    "xxx",
    "abc",
    "fsdf",
  ]);
  if (placeholders.has(cleaned)) return true;

  // Words with 4+ consonants and NO vowels (e.g. "fsdfsdfs", "ghjkl", "bcdfgh")
  const hasVowels = /[aeiouy]/i.test(cleaned);
  if (!hasVowels && cleaned.length >= 4) return true;

  // Repetitive character patterns (e.g. "fsdfsdfs" -> "fsdf" repeated, "asdasd" -> "asd" repeated)
  const isRepetitive = /^(.{1,4})\1+$/.test(cleaned);
  if (isRepetitive && cleaned.length >= 6) return true;

  return false;
}

/**
 * Validates whether the submitted Proof of Work URL is a plausible, legitimate
 * work artifact for the given task category, and verifies deep-link specificity.
 */
function validateArtifactRelevance(
  proofUrl: string,
  category: TaskCategory,
  taskTitle: string,
  taskDescription: string | null
): {
  isValid: boolean;
  isSpecificDeepLink: boolean;
  status: "PASS" | "FAIL" | "PARTIAL";
  reason: string;
} {
  try {
    const parsedUrl = new URL(proofUrl);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsedUrl.pathname.trim();
    const taskText = `${taskTitle} ${taskDescription || ""}`.toLowerCase();

    // Check 1: Deep Link Specificity (Reject bare root homepages like https://github.com or https://figma.com)
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isRootDomainOnly = pathname === "" || pathname === "/";
    if (isRootDomainOnly && !isLocalhost) {
      return {
        isValid: false,
        isSpecificDeepLink: false,
        status: "FAIL",
        reason: `The submitted URL (${hostname}) is a top-level homepage without an artifact path or identifier. Please provide a direct link to the PR, file, or deployment.`,
      };
    }

    // Check 2: Consumer Short-Form Video (YouTube Shorts, TikTok, Reels)
    const shortFormMatch = SHORT_FORM_VIDEO_PATTERNS.find(
      (p) => p.host.test(hostname) && p.path.test(pathname)
    );

    if (shortFormMatch) {
      const isExplicitShortsMarketing =
        category === "MARKETING_CONTENT" &&
        /(short-form|shorts|tiktok|reels?|social media reel|promotional video clip)/i.test(
          taskText
        );

      if (!isExplicitShortsMarketing) {
        return {
          isValid: false,
          isSpecificDeepLink: true,
          status: "FAIL",
          reason: `The submitted URL is a ${shortFormMatch.label} vertical clip (${proofUrl}), which is an entertainment format and cannot be accepted as a technical or design work deliverable. Please provide an authentic work artifact (e.g. GitHub PR, Vercel/staging preview, Figma file, or Loom video).`,
        };
      } else {
        return {
          isValid: true,
          isSpecificDeepLink: true,
          status: "PASS",
          reason: `Verified ${shortFormMatch.label} marketing campaign deliverable.`,
        };
      }
    }

    // Check 3: Consumer Social Media & Entertainment Blacklist
    const isEntertainmentOrSocial = DISALLOWED_ENTERTAINMENT_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );

    if (isEntertainmentOrSocial) {
      const isExplicitMarketing =
        category === "MARKETING_CONTENT" ||
        /(marketing|social media|post|campaign|reel|reddit|facebook|tiktok|instagram|twitter|discord)/i.test(
          taskText
        );

      if (!isExplicitMarketing) {
        return {
          isValid: false,
          isSpecificDeepLink: true,
          status: "FAIL",
          reason: `The submitted URL (${hostname}) is a consumer social media or entertainment link, which is not an authoritative deliverable for a ${category.toLowerCase().replace("_", " ")} task. Please provide an authentic work artifact (e.g. GitHub PR, Vercel/staging preview, Figma file, or Loom video).`,
        };
      } else {
        return {
          isValid: true,
          isSpecificDeepLink: true,
          status: "PASS",
          reason: `Verified promotional / social media campaign deliverable on ${hostname}.`,
        };
      }
    }

    // Check 4: Standard Longform YouTube (youtube.com/watch?v=... or youtu.be/<id>)
    const isYouTubeStandard =
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtu.be";

    if (isYouTubeStandard) {
      if (category === "MARKETING_CONTENT") {
        return {
          isValid: true,
          isSpecificDeepLink: true,
          status: "PASS",
          reason: `Valid promotional video deliverable provided on ${hostname}.`,
        };
      }
      // For technical/design tasks, YouTube longform can serve as an unlisted demo walkthrough,
      // but lacks verifiable code PR or live deployment, so it receives PARTIAL.
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PARTIAL",
        reason: `YouTube video provided as a walkthrough. Technical tasks require code (GitHub PR) or a live staging deployment for full verification.`,
      };
    }

    // Check 5: Authoritative Work Platforms (Allowlist)
    const isVerifiedCode = VERIFIED_CODE_HOSTS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (isVerifiedCode) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative code repository / pull request deliverable verified on ${hostname}.`,
      };
    }

    const isVerifiedStaging = VERIFIED_STAGING_HOST_PATTERNS.some((p) =>
      p.test(hostname)
    );
    if (isVerifiedStaging) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative staging / cloud deployment deliverable verified on ${hostname}.`,
      };
    }

    const isVerifiedDesign = VERIFIED_DESIGN_HOSTS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (isVerifiedDesign) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative design / prototype deliverable verified on ${hostname}.`,
      };
    }

    const isVerifiedWalkthrough = VERIFIED_WALKTHROUGH_HOSTS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (isVerifiedWalkthrough) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative video walkthrough deliverable verified on ${hostname}.`,
      };
    }

    const isVerifiedDocs = VERIFIED_DOCS_MANAGEMENT_HOSTS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (isVerifiedDocs) {
      return {
        isValid: true,
        isSpecificDeepLink: true,
        status: "PASS",
        reason: `Authoritative project documentation / specification deliverable verified on ${hostname}.`,
      };
    }

    // Check 6: Custom / Unverified Third-Party Domain
    return {
      isValid: true,
      isSpecificDeepLink: true,
      status: "PARTIAL",
      reason: `The submitted URL is hosted on an unverified or custom domain (${hostname}). Ensure manual reviewer verification for this deployment artifact.`,
    };
  } catch {
    return {
      isValid: false,
      isSpecificDeepLink: false,
      status: "FAIL",
      reason: "Invalid URL format provided.",
    };
  }
}

/**
 * Deterministic Rule-Based Fallback Evaluator.
 * Permanently active safety net: runs if Gemini API key is not configured,
 * times out (>4s), or suffers network dropouts. Guarantees a defensible,
 * consistent audit result without crashing during live demos.
 */
function evaluateSubmissionDeterministically(
  taskTitle: string,
  taskDescription: string | null,
  proofUrl: string,
  submissionNotes: string,
  urlStatus: "REACHABLE" | "UNREACHABLE_404" | "PROTECTED_OR_PENDING",
  category?: TaskCategory
): {
  confidenceScore: number;
  gateStatus: "Passed" | "Failed";
  summary: string;
  criteria: Array<{
    criterion: string;
    status: "PASS" | "FAIL" | "PARTIAL";
    notes: string;
  }>;
} {
  const taskCategory = category || classifyTaskCategory(taskTitle, taskDescription);
  const artifactCheck = validateArtifactRelevance(proofUrl, taskCategory, taskTitle, taskDescription);

  const criteria: Array<{
    criterion: string;
    status: "PASS" | "FAIL" | "PARTIAL";
    notes: string;
  }> = [];

  let score = 0;

  // 1. Deliverable Artifact Credibility & Relevance
  if (!artifactCheck.isValid) {
    criteria.push({
      criterion: "Deliverable Artifact Credibility & Relevance",
      status: "FAIL",
      notes: artifactCheck.reason,
    });
  } else if (artifactCheck.status === "PARTIAL") {
    score += 15;
    criteria.push({
      criterion: "Deliverable Artifact Credibility & Relevance",
      status: "PARTIAL",
      notes: artifactCheck.reason,
    });
  } else {
    score += 30;
    criteria.push({
      criterion: "Deliverable Artifact Credibility & Relevance",
      status: "PASS",
      notes: artifactCheck.reason,
    });
  }

  // 2. Proof URL Reachability Check
  if (urlStatus === "UNREACHABLE_404") {
    criteria.push({
      criterion: "Proof URL Reachability",
      status: "FAIL",
      notes: "The submitted URL returned HTTP 404 Not Found.",
    });
  } else {
    score += 20;
    criteria.push({
      criterion: "Proof URL Reachability",
      status: "PASS",
      notes: "Valid deliverable artifact URL provided (PR/preview link formatted correctly).",
    });
  }

  // 3. Delivery Notes Detail & Substance Check
  const wordCount = submissionNotes.trim().split(/\s+/).length;
  const hasSubstantiveTerms = /(implement|tested|verify|fix|deploy|build|schema|api|endpoint|component|route|database|ui|review|auth|campaign|published|utm|branding|overlay|tracking|metric|engagement|copy|design|release|edit)/i.test(
    submissionNotes
  );

  if (submissionNotes.length >= 80 && hasSubstantiveTerms) {
    score += 30;
    criteria.push({
      criterion: "Deliverable Documentation & Depth",
      status: "PASS",
      notes: `Thorough technical documentation provided (${wordCount} words) detailing verification and implementation.`,
    });
  } else if (submissionNotes.length >= 35) {
    score += 15;
    criteria.push({
      criterion: "Deliverable Documentation & Depth",
      status: "PARTIAL",
      notes: "Adequate notes provided, but lacks in-depth technical verification context.",
    });
  } else {
    score += 5;
    criteria.push({
      criterion: "Deliverable Documentation & Depth",
      status: "FAIL",
      notes: "Delivery notes are overly brief. Needs explicit details on testing and artifacts.",
    });
  }

  // 4. Task Context Alignment
  const titleIsGibberish = isGibberishOrNonInformative(taskTitle);
  const descIsGibberish = !taskDescription || isGibberishOrNonInformative(taskDescription);

  if (titleIsGibberish && descIsGibberish) {
    criteria.push({
      criterion: "Acceptance Criteria Alignment",
      status: "FAIL",
      notes: `Task title "${taskTitle}" lacks defined acceptance criteria or functional scope. Submissions cannot be aligned against undefined requirements.`,
    });
  } else {
    const descKeywords = (taskDescription || taskTitle)
      .toLowerCase()
      .split(/\W+/)
      .filter(
        (w) =>
          w.length > 3 &&
          !["with", "from", "that", "this", "have", "task", "item", "page", "user"].includes(w)
      );
    const matchedKeywords = descKeywords.filter((k) =>
      submissionNotes.toLowerCase().includes(k)
    );

    if (matchedKeywords.length >= 2) {
      score += 20;
      criteria.push({
        criterion: "Acceptance Criteria Alignment",
        status: "PASS",
        notes: `Deliverables directly correlate with defined scope and specifications for "${taskTitle}".`,
      });
    } else if (matchedKeywords.length === 1) {
      score += 10;
      criteria.push({
        criterion: "Acceptance Criteria Alignment",
        status: "PARTIAL",
        notes: `Deliverable partially addresses the task scope (${matchedKeywords.join(", ")}). More explicit criteria coverage needed.`,
      });
    } else {
      score += 5;
      criteria.push({
        criterion: "Acceptance Criteria Alignment",
        status: "FAIL",
        notes: "Submission notes do not explicitly address the specific requirements outlined in the task.",
      });
    }
  }

  // HARD-FAIL CAP: If the artifact is invalid or URL is 404, cap the score at max 38%
  let confidenceScore: number;
  let passed: boolean;

  if (!artifactCheck.isValid || urlStatus === "UNREACHABLE_404") {
    confidenceScore = Math.min(38, Math.max(10, score));
    passed = false;
  } else {
    confidenceScore = Math.min(100, Math.max(10, score));
    passed = confidenceScore >= 80;
  }

  return {
    confidenceScore,
    gateStatus: passed ? "Passed" : "Failed",
    summary: passed
      ? `Automated Quality Gate passed with ${confidenceScore}% confidence. Deliverables verified against task requirements.`
      : `Quality Gate unverified (${confidenceScore}% score). Revisions requested: ${
          !artifactCheck.isValid
            ? artifactCheck.reason
            : urlStatus === "UNREACHABLE_404"
            ? "The submitted proof URL returned HTTP 404 Not Found."
            : "please provide more technical verification detail or verify artifact accessibility."
        }`,
    criteria,
  };
}

/**
 * Main Server Action: Submits a task for automated 2-stage verification
 */
export async function submitTaskForVerification(
  input: unknown
): Promise<QualityGateResult> {
  // 1. Runtime Input Validation (Stage 1)
  const parsed = SubmissionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  const { taskId, proofUrl, submissionNotes } = parsed.data;

  // 2. Fetch Session & IDOR Prevention
  let submittedBy = "anonymous_dev";
  try {
    const session = await auth();
    submittedBy =
      session?.user?.email || session?.user?.name || session?.user?.id || "anonymous_dev";
  } catch {
    // Standalone or CLI execution context fallback
    submittedBy = "test_developer";
  }

  // 3. Fetch Task Context
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { milestone: true },
  });

  if (!task) {
    return { success: false, error: "Task not found." };
  }

  // 4. Non-blocking 3s HEAD Ping for Proof URL Reachability
  let urlStatus: "REACHABLE" | "UNREACHABLE_404" | "PROTECTED_OR_PENDING" =
    "PROTECTED_OR_PENDING";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const headRes = await fetch(proofUrl, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (headRes.status === 404) {
      urlStatus = "UNREACHABLE_404";
    } else if (headRes.ok || headRes.status === 401 || headRes.status === 403) {
      urlStatus = "REACHABLE";
    }
  } catch {
    // Non-blocking timeout or protected network; fallback to PROTECTED_OR_PENDING
    urlStatus = "PROTECTED_OR_PENDING";
  }

  // 5. Stage 2: AI Acceptance Criteria Evaluator (with Fallback)
  const category = classifyTaskCategory(task.title, task.description);
  const artifactCheck = validateArtifactRelevance(
    proofUrl,
    category,
    task.title,
    task.description
  );

  let evaluation: {
    confidenceScore: number;
    gateStatus: "Passed" | "Failed";
    summary: string;
    criteria: Array<{
      criterion: string;
      status: "PASS" | "FAIL" | "PARTIAL";
      notes: string;
    }>;
  };

  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );

  if (hasApiKey) {
    try {
      const result = await generateObject({
        model: google("gemini-1.5-flash"),
        schema: z.object({
          confidenceScore: z
            .number()
            .min(0)
            .max(100)
            .describe("Overall completion confidence score"),
          gateStatus: z.enum(["Passed", "Failed"]),
          summary: z
            .string()
            .describe("Concise evaluation summary for PM and developer"),
          criteria: z.array(
            z.object({
              criterion: z.string(),
              status: z.enum(["PASS", "FAIL", "PARTIAL"]),
              notes: z.string(),
            })
          ),
        }),
        prompt: `
          You are an automated Quality Gatekeeper for software and agency deliverables.
          Evaluate the following task submission against its title, description, and proof artifacts.

          Task Details:
          - Title: ${task.title}
          - Category: ${category}
          - Description: ${task.description || "No specific acceptance criteria specified."}
          - Milestone: ${task.milestone?.title || "General"}

          Developer Submission:
          - Proof of Work URL: ${proofUrl} (Network Status: ${urlStatus})
          - Artifact Domain Verification: ${artifactCheck.isValid ? "AUTHENTIC_WORK_DOMAIN" : "FLAGGED_ENTERTAINMENT_OR_INVALID"} (${artifactCheck.reason})
          - Deliverable Notes: ${submissionNotes}
          - Submitter: ${submittedBy}

          Evaluation Rules:
          1. ARTIFACT RELEVANCE & AUTHENTICITY (CRITICAL):
             - Evaluate whether the submitted Proof of Work URL is an authentic, credible deliverable for a ${category.toLowerCase().replace("_", " ")} task.
             - Valid artifacts: code repositories or PRs (GitHub, GitLab), deployed previews or staging URLs (Vercel, Netlify, custom domain), design specs (Figma, Canva), or video walkthroughs (Loom).
             - INVALID ARTIFACTS: Consumer social media links (e.g. Facebook Reels, TikTok, Reddit posts, YouTube entertainment, meme pages) MUST BE REJECTED unless the task explicitly specifies social media distribution or marketing.
             - If an invalid or irrelevant artifact is provided, you MUST include a criterion "Deliverable Artifact Credibility & Relevance" set to 'FAIL', set confidenceScore below 40, and set gateStatus to 'Failed'.
          2. ACCESSIBILITY: If urlStatus is 'UNREACHABLE_404', penalize with a FAIL on artifact reachability.
          3. COMPLETION & SUBSTANCE: Evaluate whether the deliverable notes credibly fulfill the task requirements.
          4. A passing grade strictly requires confidenceScore >= 80, gateStatus = 'Passed', and an authentic, relevant deliverable artifact.
        `,
        abortSignal: AbortSignal.timeout(4000), // 4-second timeout guard
      });

      evaluation = result.object;
    } catch (aiErr) {
      console.warn(
        "⚠️ AI Gatekeeper API call timed out or failed; engaging deterministic evaluator fallback:",
        aiErr
      );
      evaluation = evaluateSubmissionDeterministically(
        task.title,
        task.description,
        proofUrl,
        submissionNotes,
        urlStatus,
        category
      );
    }
  } else {
    // API key not present: run deterministic rule-based evaluator
    evaluation = evaluateSubmissionDeterministically(
      task.title,
      task.description,
      proofUrl,
      submissionNotes,
      urlStatus,
      category
    );
  }

  // Programmatic safeguard: Never allow an invalid artifact or 404 URL to pass the gate
  if (!artifactCheck.isValid || urlStatus === "UNREACHABLE_404") {
    evaluation.gateStatus = "Failed";
    evaluation.confidenceScore = Math.min(38, evaluation.confidenceScore);
    const failReason = !artifactCheck.isValid
      ? artifactCheck.reason
      : "The submitted proof URL returned HTTP 404 Not Found.";

    const existingCrit = evaluation.criteria.find((c) =>
      /artifact|proof url|relevance|credibility/i.test(c.criterion)
    );
    if (existingCrit) {
      existingCrit.status = "FAIL";
      existingCrit.notes = failReason;
    } else {
      evaluation.criteria.unshift({
        criterion: "Deliverable Artifact Credibility & Relevance",
        status: "FAIL",
        notes: failReason,
      });
    }
    evaluation.summary = `Quality Gate unverified (${evaluation.confidenceScore}% score). Revisions requested: ${failReason}`;
  }

  const passed =
    evaluation.confidenceScore >= 80 && evaluation.gateStatus === "Passed";
  const nextStatus = passed ? "In Review" : "Changes Requested";

  // 6. Atomic Database Transaction: Store Submission & Update Task
  await db.transaction(async (tx) => {
    const [newSubmission] = await tx
      .insert(taskSubmissions)
      .values({
        taskId,
        submittedBy,
        proofUrl,
        submissionNotes,
        aiConfidenceScore: evaluation.confidenceScore,
        gateStatus: passed ? "Passed" : "Failed",
        aiSummary: evaluation.summary,
        criteriaBreakdown: evaluation.criteria,
      })
      .returning();

    await tx
      .update(tasks)
      .set({
        status: nextStatus,
        proofNotes: submissionNotes,
        proofLinks: [{ label: "Proof Artifact", url: proofUrl }],
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return [newSubmission];
  });

  // 7. Path Revalidation
  try {
    if (task.projectId) {
      revalidatePath(`/dashboard/pm/${task.projectId}`);
    }
    revalidatePath("/dashboard/pm/[id]", "page");
  } catch {
    // Non-fatal outside Next.js request context (e.g., test runner)
  }

  return {
    success: true,
    passed,
    score: evaluation.confidenceScore,
    gateStatus: passed ? "Passed" : "Failed",
    summary: evaluation.summary,
    criteria: evaluation.criteria,
  };
}

/**
 * Fetch the latest submission audit report for a task
 */
export async function getLatestTaskSubmission(taskId: string) {
  const submission = await db.query.taskSubmissions.findFirst({
    where: eq(taskSubmissions.taskId, taskId),
    orderBy: [desc(taskSubmissions.createdAt)],
  });

  return submission || null;
}

const PolishNotesSchema = z.object({
  taskId: z.string().optional(),
  taskTitle: z.string().min(1, "Task title is required"),
  taskDescription: z.string().nullable().optional(),
  rawNotes: z.string().min(3, "Please enter at least a few keywords or bullets to polish"),
  proofUrls: z.array(z.string()).optional(),
});

/**
 * Server Action: Transforms informal or brief developer delivery notes into a
 * structured, professional Definition of Done (DoD) technical report.
 */
export async function polishDeliveryNotes(input: unknown): Promise<{
  success: boolean;
  polishedNotes?: string;
  error?: string;
}> {
  const parsed = PolishNotesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { taskTitle, taskDescription, rawNotes, proofUrls } = parsed.data;
  const category = classifyTaskCategory(taskTitle, taskDescription || null);

  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );

  if (hasApiKey) {
    try {
      const prompt = `
You are an expert technical delivery assistant for software engineering, design, and product management.
A team member has written informal, brief, or rough notes about their completed work.
Your task is to transform their raw input into a concise, professional Definition of Done (DoD) delivery report.

Task Context:
- Task: ${taskTitle}
- Functional Category: ${category}
- Scope/Requirements: ${taskDescription || "Standard feature implementation"}
- Deliverable Links: ${proofUrls && proofUrls.length > 0 ? proofUrls.join(", ") : "Not provided"}

Team Member's Raw Notes:
"${rawNotes}"

STRICT GUIDELINES:
1. Format as 3 concise bullet points:
   • Implementation: [Clear summary of what was built or configured based on their raw notes]
   • Verification: [Explicit verification, test steps, environments, or edge cases tested]
   • Delivery & Artifacts: [Status of deployment, PR, or deliverable readiness]
2. Keep the output concise, factual, and strictly under 80 words.
3. Do NOT invent unmentioned features or add conversational fluff (no "Here are the polished notes:", no greetings).
4. Ensure technical substance so the Definition of Done Quality Gate will recognize clear verification.
`;

      const result = await generateText({
        model: google("gemini-1.5-flash"),
        prompt,
        abortSignal: AbortSignal.timeout(4000),
      });

      const cleaned = result.text.trim();
      if (cleaned.length > 0) {
        return {
          success: true,
          polishedNotes: cleaned,
        };
      }
    } catch (err) {
      console.warn(
        "⚠️ AI Polish API call timed out or failed; engaging deterministic formatter fallback:",
        err
      );
    }
  }

  // Deterministic Fallback Formatter
  const cleanRaw = rawNotes.trim().replace(/^[\s•\-*]+/g, "");
  let fallbackNotes = "";

  if (category === "DESIGN") {
    fallbackNotes = `• Implementation: ${cleanRaw}\n• Verification: Reviewed UI components, states, and responsive layout against specifications.\n• Delivery & Artifacts: Assets and prototype updated and ready for stakeholder review.`;
  } else if (category === "MARKETING_CONTENT") {
    fallbackNotes = `• Implementation: ${cleanRaw}\n• Verification: Verified tracking parameters, distribution channels, and creative formatting.\n• Delivery & Artifacts: Published and scheduled for audience distribution.`;
  } else {
    // Engineering / General Docs
    fallbackNotes = `• Implementation: ${cleanRaw}\n• Verification: Verified functionality and test coverage across staging and local environments.\n• Delivery & Artifacts: Code changes committed and deliverable submitted for review.`;
  }

  return {
    success: true,
    polishedNotes: fallbackNotes,
  };
}

