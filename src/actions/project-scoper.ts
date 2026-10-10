"use server";

import { db } from "@/db";
import { agencyProjects, milestones, tasks, projectStakeholders } from "@/db/schema";
import { z } from "zod";
import { generateObject } from "ai";
import { getAIModel } from "@/lib/ai";
import { auth, hasRole } from "@/auth";
import { logAction } from "@/features/audit/actions";
import { logSystemError } from "@/features/audit/error-logger";
import { revalidatePath } from "next/cache";

const ScopeSchema = z.object({
  projectTitle: z.string().min(3).describe("Concise, professional project title reflecting the client's domain"),
  projectDescription: z.string().min(10).describe("Executive summary of the client's scope and objectives"),
  milestones: z.array(z.object({
    title: z.string().min(3).describe("Domain-specific milestone name, e.g. 'Pet Profiles & Booking Flow', never 'Core Features'"),
    order: z.number().int().min(1),
    tasks: z.array(z.object({
      title: z.string().min(3).describe("Concrete actionable task title tailored to this project"),
      description: z.string().min(5).describe("Clear implementation and acceptance criteria"),
      weight: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).describe("Fibonacci complexity points: strictly 1, 2, 3, or 5"),
      estimatedHours: z.number().int().min(1).max(40).describe("Realistic development effort in hours (1-40)"),
    })).min(1).max(8)
  })).min(2).max(5)
});

export type ParsedScope = z.infer<typeof ScopeSchema>;

export async function analyzeScopeWithAI(rawBrief: string): Promise<{ success: boolean; data?: ParsedScope; error?: string }> {
  const session = await auth();
  // Role check: Allow superadmin and manager (Agency PMs)
  if (!hasRole(session, ["superadmin", "manager"])) {
    return { success: false, error: "Unauthorized: Only Managers and Superadmins can generate project scopes." };
  }

  const trimmedBrief = rawBrief?.trim() || "";
  if (trimmedBrief.length < 10) {
    return { success: false, error: "Please provide a more descriptive brief (minimum 10 characters)." };
  }

  const sanitizedBrief = trimmedBrief.slice(0, 8000);

  try {
    // If no API key is configured, utilize domain-aware fallback generator
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.log("No Gemini API key found, engaging domain-aware offline fallback generator.");
      return { success: true, data: generateOfflineFallback(sanitizedBrief) };
    }

    const { object } = await generateObject({
      model: getAIModel(),
      schema: ScopeSchema,
      system: `
You are an expert Agile Scrum Master and Technical Project Manager for Optrizo Agency OS.
Your objective is to deconstruct a raw client inquiry into an execution-ready, domain-tailored Agile project plan.

STRICT PRINCIPLES:
1. DOMAIN SPECIFICITY: Every Milestone title MUST reflect the client's actual industry, core feature, or domain (e.g., "Dental Appointment & Calendar Engine", "Pet Profiles & Geolocation Tracking", "Bakery Catalog & Cart Checkout"). NEVER use generic placeholders like "Foundation & Infrastructure", "Phase 1", "Core Features", or "Backend Setup".
2. ACTIONABLE DELIVERABLES: Every task must describe a concrete technical deliverable for THIS specific business problem (e.g., "Build interactive canine profile editor with vaccine record uploads", "Integrate Stripe Connect payout split for freelance walkers").
3. FIBONACCI COMPLEXITY: Story point weight must be strictly 1 (quick config/setup), 2 (standard UI/CRUD), 3 (complex business logic/API), or 5 (heavy algorithmic/architectural feature).
4. ESTIMATED EFFORT: Estimate realistic, conservative hours between 2 and 24 hours per task.
5. NO FLUFF: Keep descriptions concise and technical.
`,
      prompt: `CLIENT INQUIRY & BRIEF:\n"""\n${sanitizedBrief}\n"""\n\nDeconstruct the above brief into 2 to 4 domain-tailored milestones with 2 to 5 actionable tasks per milestone.`,
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("AI Generation encountered an error, using domain-aware fallback:", error);
    await logSystemError(error, {
      errorCode: "AI_SCOPE_GENERATION_FALLBACK",
      severity: "LOW",
      source: "action:project-scoper:analyzeScopeWithAI",
      context: { briefSnippet: sanitizedBrief.slice(0, 100) },
      userId: session?.user?.id,
    });
    return { success: true, data: generateOfflineFallback(sanitizedBrief) };
  }
}

/**
 * Smart Domain-Aware Fallback Generator
 * Dynamically analyzes the client brief keywords to generate tailored milestones and tasks
 * even when offline or when API quota is exhausted during a live presentation.
 */
function generateOfflineFallback(brief: string): ParsedScope {
  const lower = brief.toLowerCase();

  // Extract clean project title
  const words = brief.replace(/[^a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const firstPhrase = words.slice(0, 6).join(" ");
  const capitalizedTitle = firstPhrase
    ? firstPhrase.charAt(0).toUpperCase() + firstPhrase.slice(1) + " System"
    : "Custom Agency Project Plan";

  const milestonesList: ParsedScope["milestones"] = [];
  let orderIndex = 1;

  // 1. Data Modeling & Core Domain Architecture
  milestonesList.push({
    title: "Domain Data Architecture & Entities",
    order: orderIndex++,
    tasks: [
      {
        title: "Model Schema for " + (words.slice(0, 3).join(" ") || "Core Entities"),
        description: "Design relational database schema and migration models based on client specifications.",
        weight: 3,
        estimatedHours: 8,
      },
      {
        title: "User Role & Authentication Flow",
        description: "Configure multi-role session management and access boundaries.",
        weight: 2,
        estimatedHours: 6,
      },
    ],
  });

  // 2. Detected Functional Features
  const functionalTasks: Array<{ title: string; description: string; weight: 1 | 2 | 3 | 5; estimatedHours: number }> = [];

  if (lower.includes("map") || lower.includes("gps") || lower.includes("location") || lower.includes("tracking")) {
    functionalTasks.push({
      title: "Real-time Geolocation & Map Integration",
      description: "Integrate mapping SDK, interactive marker rendering, and coordinate routing.",
      weight: 5,
      estimatedHours: 16,
    });
  }

  if (lower.includes("pay") || lower.includes("stripe") || lower.includes("checkout") || lower.includes("billing") || lower.includes("cart")) {
    functionalTasks.push({
      title: "Payment Gateway & Transaction Processing",
      description: "Implement secure payment checkout, webhook listener, and transaction records.",
      weight: 5,
      estimatedHours: 14,
    });
  }

  if (lower.includes("booking") || lower.includes("appointment") || lower.includes("schedule") || lower.includes("calendar")) {
    functionalTasks.push({
      title: "Booking & Availability Scheduling Engine",
      description: "Develop time-slot reservation system with conflict detection and calendar sync.",
      weight: 3,
      estimatedHours: 12,
    });
  }

  if (lower.includes("rating") || lower.includes("review") || lower.includes("feedback")) {
    functionalTasks.push({
      title: "Customer Rating & Review Workflow",
      description: "Build star-rating submission UI with automated sentiment validation.",
      weight: 2,
      estimatedHours: 6,
    });
  }

  if (lower.includes("notification") || lower.includes("sms") || lower.includes("alert") || lower.includes("email")) {
    functionalTasks.push({
      title: "Automated Notification & Alerts Service",
      description: "Configure transactional email and SMS triggers for key event milestones.",
      weight: 2,
      estimatedHours: 6,
    });
  }

  // Default functional tasks if none matched
  if (functionalTasks.length === 0) {
    functionalTasks.push(
      {
        title: "Primary Interactive Workflow & Dashboard UI",
        description: "Build user interface and responsive views matching requirements: " + brief.slice(0, 60) + "...",
        weight: 3,
        estimatedHours: 10,
      },
      {
        title: "API Business Logic & Validation Handlers",
        description: "Implement backend mutations and server actions enforcing business rules.",
        weight: 3,
        estimatedHours: 8,
      }
    );
  }

  milestonesList.push({
    title: "Core Functional Modules & Workflows",
    order: orderIndex++,
    tasks: functionalTasks,
  });

  // 3. Verification & Deployment Milestone
  milestonesList.push({
    title: "Quality Verification, Security & Launch",
    order: orderIndex++,
    tasks: [
      {
        title: "Automated Testing & End-to-End Verification",
        description: "Execute regression suite, verify deliverable acceptance criteria, and perform load check.",
        weight: 2,
        estimatedHours: 6,
      },
      {
        title: "Staging Preview & Production Deployment",
        description: "Deploy to cloud infrastructure, configure custom domains, and hand off client portal.",
        weight: 1,
        estimatedHours: 4,
      },
    ],
  });

  return {
    projectTitle: capitalizedTitle,
    projectDescription: "Agile project deconstruction tailored for: " + brief.substring(0, 80) + "...",
    milestones: milestonesList,
  };
}

export async function provisionProjectFromScope(
  data: ParsedScope,
  rawBrief: string
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  const session = await auth();
  if (!hasRole(session, ["superadmin", "manager"])) {
    return { success: false, error: "Unauthorized: Only Managers and Superadmins can provision projects." };
  }

  try {
    let totalTasksCount = 0;

    const projectId = await db.transaction(async (tx) => {
      // 1. Create Project
      const [newProject] = await tx
        .insert(agencyProjects)
        .values({
          title: data.projectTitle,
          description: data.projectDescription,
          sourceBrief: rawBrief,
          status: "Kickoff",
        })
        .returning({ id: agencyProjects.id });

      // 2. Attach creating manager as project stakeholder
      if (session?.user?.id) {
        await tx.insert(projectStakeholders).values({
          projectId: newProject.id,
          userId: session.user.id,
        }).onConflictDoNothing();
      }

      // 3. Create Milestones and Tasks
      for (const m of data.milestones) {
        const [newMilestone] = await tx
          .insert(milestones)
          .values({
            projectId: newProject.id,
            title: m.title,
            order: m.order,
            status: "Pending",
          })
          .returning({ id: milestones.id });

        if (m.tasks.length > 0) {
          totalTasksCount += m.tasks.length;
          await tx.insert(tasks).values(
            m.tasks.map((t) => ({
              projectId: newProject.id,
              milestoneId: newMilestone.id,
              title: t.title,
              description: t.description,
              weight: t.weight,
              estimatedHours: t.estimatedHours,
              status: "Todo" as const,
            }))
          );
        }
      }

      return newProject.id;
    });

    // 4. Log immutable audit action
    await logAction(
      "CREATE",
      "Project",
      `AI-Assisted Scoper provisioned project "${data.projectTitle}" (${totalTasksCount} tasks) from client brief`,
      session?.user?.id
    );

    revalidatePath("/dashboard/pm");
    revalidatePath("/dashboard/pm/[id]", "page");

    return { success: true, projectId };
  } catch (error: any) {
    console.error("Failed to provision project:", error);
    await logSystemError(error, {
      errorCode: "PROJECT_PROVISIONING_FAILED",
      severity: "HIGH",
      source: "action:project-scoper:provisionProjectFromScope",
      context: { projectTitle: data.projectTitle, briefSnippet: rawBrief.slice(0, 100) },
      userId: session?.user?.id,
    });
    return { success: false, error: error.message || "Failed to provision project" };
  }
}
