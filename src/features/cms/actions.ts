"use server";

import { db } from "@/db";
import { siteSettings, posts } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth"; // Need auth to get authorId

// --- Global Settings ---

export async function getSiteSettings() {
    const settings = await db.query.siteSettings.findFirst();
    return settings;
}

export type SiteSettingsState = {
    message: string;
    success: boolean;
};

export async function updateSiteSettings(prevState: SiteSettingsState, formData: FormData) {
    const rawData = {
        heroTitle: formData.get("heroTitle") as string,
        heroDescription: formData.get("heroDescription") as string,
        aboutText: formData.get("aboutText") as string,
        logoUrl: formData.get("logoUrl") as string,
        contactEmail: formData.get("contactEmail") as string,
    };

    try {
        await db.insert(siteSettings)
            .values({ id: "1", ...rawData })
            .onConflictDoUpdate({
                target: siteSettings.id,
                set: rawData,
            });

        revalidatePath("/");
        return { success: true, message: "Settings updated successfully!" };
    } catch (error) {
        console.error("Failed to update settings:", error);
        return { success: false, message: "Failed to update settings." };
    }
}

// --- Posts ---

export type CreatePostState = {
    message: string;
    success: boolean;
};

export async function createPost(prevState: CreatePostState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const title = formData.get("title") as string;
    let slug = formData.get("slug") as string;

    // Auto-generate slug from title if empty
    if (!slug) {
        slug = title;
    }

    // Sanitize slug: lowercase, replace spaces with -, remove non-alphanumeric
    const sanitizedSlug = slug
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const content = formData.get("content") as string; // HTML string from Tiptap

    try {
        await db.insert(posts).values({
            title,
            slug: sanitizedSlug,
            content,
            authorId: session.user.id,
            published: true, // Auto-publish for now
        });

        revalidatePath("/dashboard/posts");
        revalidatePath("/blog");
        return { success: true, message: "Post created successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed to create post. Slug might be taken." };
    }
}

export async function deletePost(id: string) {
    await db.delete(posts).where(eq(posts.id, id));
    revalidatePath("/dashboard/posts");
}
