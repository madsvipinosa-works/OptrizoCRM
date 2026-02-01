"use server";

import { db } from "@/db";

import { siteSettings, posts, projects, services, testimonials } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

// --- Helper Functions ---

function sanitizeSlug(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function requireAdmin() {
    const session = await auth();
    if (session?.user?.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
    }
    return session;
}

async function requireEditor() {
    const session = await auth();
    if (session?.user?.role !== "admin" && session?.user?.role !== "editor") {
        throw new Error("Unauthorized: Editor access required");
    }
    return session;
}

// --- Global Settings ---

export async function getSiteSettings() {
    const settings = await db.query.siteSettings.findFirst();
    return settings;
}

export type ActionState = {
    message: string;
    success: boolean;
};

export async function updateSiteSettings(prevState: ActionState, formData: FormData) {
    try {
        await requireAdmin();

        const rawData = {
            heroTitle: formData.get("heroTitle") as string,
            heroDescription: formData.get("heroDescription") as string,
            aboutText: formData.get("aboutText") as string,
            logoUrl: formData.get("logoUrl") as string,
            faviconUrl: formData.get("faviconUrl") as string,
            contactEmail: formData.get("contactEmail") as string,
            notificationEmails: formData.get("notificationEmails") as string,
        };

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

export async function createPost(prevState: ActionState, formData: FormData) {
    try {
        const session = await requireEditor();

        const title = formData.get("title") as string;
        let slug = formData.get("slug") as string;

        if (!slug) slug = title;
        const sanitizedSlug = sanitizeSlug(slug);

        const content = formData.get("content") as string;
        const coverImage = formData.get("coverImage") as string;

        await db.insert(posts).values({
            title,
            slug: sanitizedSlug,
            content,
            coverImage,
            authorId: session.user.id!,
            published: true,
        });

        revalidatePath("/dashboard/posts");
        revalidatePath("/blog");
        return { success: true, message: "Post created successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed. " + (error as Error).message };
    }
}

export async function deletePost(id: string) {
    await requireEditor();
    await db.delete(posts).where(eq(posts.id, id));
    revalidatePath("/dashboard/posts");
}

export async function updatePost(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const id = formData.get("id") as string;
        const title = formData.get("title") as string;
        let slug = formData.get("slug") as string;

        if (!slug) slug = title;
        const sanitizedSlug = sanitizeSlug(slug);

        const content = formData.get("content") as string;
        const coverImage = formData.get("coverImage") as string;

        await db.update(posts)
            .set({
                title,
                slug: sanitizedSlug,
                content,
                coverImage,
                updatedAt: new Date(),
            })
            .where(eq(posts.id, id));

        revalidatePath("/dashboard/posts");
        revalidatePath(`/blog/${sanitizedSlug}`);
        return { success: true, message: "Post updated successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed. " + (error as Error).message };
    }
}

// --- Projects ---

export async function createProject(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const title = formData.get("title") as string;
        const clientName = formData.get("clientName") as string;
        const description = formData.get("description") as string;
        let slug = formData.get("slug") as string;

        if (!slug) slug = title;
        const sanitizedSlug = sanitizeSlug(slug);

        const content = formData.get("content") as string;
        const coverImage = formData.get("coverImage") as string;

        await db.insert(projects).values({
            title,
            slug: sanitizedSlug,
            clientName,
            description,
            content,
            coverImage,
            status: "published",
        });

        revalidatePath("/dashboard/projects");
        return { success: true, message: "Project created successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed. " + (error as Error).message };
    }
}

export async function deleteProject(id: string) {
    await requireEditor();
    await db.delete(projects).where(eq(projects.id, id));
    revalidatePath("/dashboard/projects");
}

export async function updateProject(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const id = formData.get("id") as string;
        const title = formData.get("title") as string;
        const clientName = formData.get("clientName") as string;
        const description = formData.get("description") as string;
        let slug = formData.get("slug") as string;

        if (!slug) slug = title;
        const sanitizedSlug = sanitizeSlug(slug);

        const content = formData.get("content") as string;
        const coverImage = formData.get("coverImage") as string;

        await db.update(projects)
            .set({
                title,
                slug: sanitizedSlug,
                clientName,
                description,
                content,
                coverImage,
                status: "published",
            })
            .where(eq(projects.id, id));

        revalidatePath("/dashboard/projects");
        revalidatePath(`/projects/${sanitizedSlug}`);
        return { success: true, message: "Project updated successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed. " + (error as Error).message };
    }
}

// --- Services ---

export async function createService(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const title = formData.get("title") as string;
        const description = formData.get("description") as string;
        const icon = formData.get("icon") as string;

        await db.insert(services).values({
            title,
            description,
            icon,
            order: 0,
        });

        revalidatePath("/dashboard/services");
        revalidatePath("/");
        return { success: true, message: "Service created successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed to create service." };
    }
}

export async function updateService(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const id = formData.get("id") as string;
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;
        const icon = formData.get("icon") as string;

        await db.update(services)
            .set({
                title,
                description,
                icon,
            })
            .where(eq(services.id, id));

        revalidatePath("/dashboard/services");
        revalidatePath("/");
        return { success: true, message: "Service updated successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed to update service." };
    }
}

export async function deleteService(id: string) {
    await requireEditor();
    await db.delete(services).where(eq(services.id, id));
    revalidatePath("/dashboard/services");
    revalidatePath("/");
}

// --- Testimonials ---

export async function createTestimonial(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const name = formData.get("name") as string;
        const role = formData.get("role") as string;
        const company = formData.get("company") as string;
        const content = formData.get("content") as string;
        const rating = parseInt(formData.get("rating") as string || "5");

        await db.insert(testimonials).values({
            name,
            role,
            company,
            content,
            rating,
            active: true,
        });

        revalidatePath("/dashboard/testimonials");
        revalidatePath("/");
        return { success: true, message: "Testimonial added!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed to add testimonial." };
    }
}

export async function updateTestimonial(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const role = formData.get("role") as string;
        const company = formData.get("company") as string;
        const content = formData.get("content") as string;
        const rating = parseInt(formData.get("rating") as string || "5");

        await db.update(testimonials)
            .set({
                name,
                role,
                company,
                content,
                rating,
                active: true,
                image: formData.get("image") as string,
            })
            .where(eq(testimonials.id, id));

        revalidatePath("/dashboard/testimonials");
        revalidatePath("/");
        return { success: true, message: "Testimonial updated!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed to update testimonial." };
    }
}

export async function deleteTestimonial(id: string) {
    await requireEditor();
    await db.delete(testimonials).where(eq(testimonials.id, id));
    revalidatePath("/dashboard/testimonials");
    revalidatePath("/");
}
