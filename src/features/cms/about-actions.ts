"use server";

import { db } from "@/db";
import { siteSettings, aboutValues, users } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export type ActionState = {
    message: string;
    success: boolean;
    errors?: Record<string, string[]>;
};

async function requireEditor() {
    const session = await auth();
    if (session?.user?.role !== "admin" && session?.user?.role !== "editor") {
        throw new Error("Unauthorized: Editor access required");
    }
    return session;
}

async function requireAdmin() {
    const session = await auth();
    if (session?.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
    }
    return session;
}

// 1. Update Mission & Stats (on siteSettings)
export async function updateAboutContent(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const aboutHeroTitle = formData.get("aboutHeroTitle") as string || "About Our Agency";
        const missionStatement = formData.get("missionStatement") as string;
        const companyStatsStr = formData.get("companyStats") as string;
        const aboutTechStackItemsStr = formData.get("aboutTechStackItems") as string;
        const aboutTechStack = formData.get("aboutTechStack") as string || "Powered By Next-Generation Technologies";
        const aboutCtaHeadline = formData.get("aboutCtaHeadline") as string || "Ready to start your next project?";
        const aboutCtaText = formData.get("aboutCtaText") as string || "Let's build something extraordinary together.";

        // basic validation
        if (!missionStatement || !companyStatsStr) {
            return { success: false, message: "Mission and Stats are required" };
        }

        // Validate JSON
        try {
            JSON.parse(companyStatsStr);
            if (aboutTechStackItemsStr) JSON.parse(aboutTechStackItemsStr);
        } catch {
             return { success: false, message: "Invalid JSON format" };
        }

        await db.insert(siteSettings)
            .values({
                id: "1",
                aboutHeroTitle,
                missionStatement,
                companyStats: companyStatsStr,
                aboutTechStackItems: aboutTechStackItemsStr,
                aboutTechStack,
                aboutCtaHeadline,
                aboutCtaText
            })
            .onConflictDoUpdate({
                target: siteSettings.id,
                set: {
                    aboutHeroTitle,
                    missionStatement,
                    companyStats: companyStatsStr,
                    aboutTechStackItems: aboutTechStackItemsStr,
                    aboutTechStack,
                    aboutCtaHeadline,
                    aboutCtaText
                }
            });

        revalidatePath("/about");
        return { success: true, message: "About content updated" };
    } catch (error) {
        console.error("About content error:", error);
        return { success: false, message: "Failed to update about content" };
    }
}

// 2. Bento Cards (aboutValues)
export async function createAboutValue(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();
        
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;
        const icon = formData.get("icon") as string;
        const order = parseInt(formData.get("order") as string || "0");

        if (!title || !description) return { success: false, message: "Title and description required" };

        await db.insert(aboutValues).values({
            title, description, icon, order
        });

        revalidatePath("/dashboard/about");
        revalidatePath("/about");
        return { success: true, message: "Value card created" };
    } catch (error) {
        console.log("Error:", error);
        return { success: false, message: "Failed to create card" };
    }
}

export async function deleteAboutValue(id: string) {
    await requireEditor();
    await db.delete(aboutValues).where(eq(aboutValues.id, id));
    revalidatePath("/dashboard/about");
    revalidatePath("/about");
}

export async function updateAboutValue(prevState: ActionState, formData: FormData) {
     try {
        await requireEditor();
        
        const id = formData.get("id") as string;
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;
        const icon = formData.get("icon") as string;
        const order = parseInt(formData.get("order") as string || "0");

        if (!id || !title || !description) return { success: false, message: "ID, Title and description required" };

        await db.update(aboutValues).set({
            title, description, icon, order
        }).where(eq(aboutValues.id, id));

        revalidatePath("/dashboard/about");
        revalidatePath("/about");
        return { success: true, message: "Value card updated" };
    } catch {
        return { success: false, message: "Failed to update card" };
    }
}

// 3. User Toggle
export async function toggleUserAboutPage(userId: string, show: boolean) {
    try {
        await requireAdmin();
        await db.update(users).set({ showOnAboutPage: show }).where(eq(users.id, userId));
        revalidatePath("/dashboard/team");
        revalidatePath("/about");
        return { success: true, message: "User visibility updated" };
    } catch {
        return { success: false, message: "Failed to toggle visibility" };
    }
}
