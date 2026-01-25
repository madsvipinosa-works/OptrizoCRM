"use server";

import { db } from "@/db";

import { siteSettings, posts, projects, services, testimonials } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth"; // Need auth to get authorId

function sanitizeSlug(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
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

export async function createPost(prevState: ActionState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const title = formData.get("title") as string;
    let slug = formData.get("slug") as string;

    // Auto-generate slug from title if empty
    if (!slug) {
        slug = title;
    }

    const sanitizedSlug = sanitizeSlug(slug);

    const content = formData.get("content") as string; // HTML string from Tiptap
    const coverImage = formData.get("coverImage") as string;

    try {
        await db.insert(posts).values({
            title,
            slug: sanitizedSlug,
            content,
            coverImage,
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

export async function updatePost(prevState: ActionState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    let slug = formData.get("slug") as string;

    if (!slug) slug = title;
    const sanitizedSlug = sanitizeSlug(slug);



    const content = formData.get("content") as string;
    const coverImage = formData.get("coverImage") as string;

    try {
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
        return { success: false, message: "Failed. Slug might be taken." };
    }
}

// --- Projects ---

export async function createProject(prevState: ActionState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const title = formData.get("title") as string;
    const clientName = formData.get("clientName") as string;
    const description = formData.get("description") as string;
    let slug = formData.get("slug") as string;

    if (!slug) slug = title;
    const sanitizedSlug = sanitizeSlug(slug);



    const content = formData.get("content") as string;
    const coverImage = formData.get("coverImage") as string;

    try {
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
        // revalidatePath("/projects"); // When we have the public page
        return { success: true, message: "Project created successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed. Slug might be taken." };
    }
}

export async function deleteProject(id: string) {
    await db.delete(projects).where(eq(projects.id, id));
    revalidatePath("/dashboard/projects");
}

export async function updateProject(prevState: ActionState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const clientName = formData.get("clientName") as string;
    const description = formData.get("description") as string;
    let slug = formData.get("slug") as string;

    if (!slug) slug = title;
    const sanitizedSlug = sanitizeSlug(slug);



    const content = formData.get("content") as string;
    const coverImage = formData.get("coverImage") as string;

    try {
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
        return { success: false, message: "Failed. Slug might be taken." };
    }
}

// --- Services ---

export async function createService(prevState: ActionState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const icon = formData.get("icon") as string;

    try {
        await db.insert(services).values({
            title,
            description,
            icon,
            order: 0, // Default order
        });

        revalidatePath("/dashboard/services");
        revalidatePath("/"); // Update home page
        return { success: true, message: "Service created successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed to create service." };
    }
}

export async function updateService(prevState: ActionState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const icon = formData.get("icon") as string;

    try {
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
    await db.delete(services).where(eq(services.id, id));
    revalidatePath("/dashboard/services");
    revalidatePath("/");
}

// --- Testimonials ---

export async function createTestimonial(prevState: ActionState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const name = formData.get("name") as string;
    const role = formData.get("role") as string;
    const company = formData.get("company") as string;
    const content = formData.get("content") as string;
    const rating = parseInt(formData.get("rating") as string || "5");

    try {
        await db.insert(testimonials).values({
            name,
            role,
            company,
            content,
            rating,
            active: true,
        });

        revalidatePath("/dashboard/testimonials");
        revalidatePath("/"); // Update home page
        return { success: true, message: "Testimonial added!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed to add testimonial." };
    }
}

export async function updateTestimonial(prevState: ActionState, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const role = formData.get("role") as string;
    const company = formData.get("company") as string;
    const content = formData.get("content") as string;
    const rating = parseInt(formData.get("rating") as string || "5");

    try {
        await db.update(testimonials)
            .set({
                name,
                role,
                company,
                content,
                rating,
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
    await db.delete(testimonials).where(eq(testimonials.id, id));
    revalidatePath("/dashboard/testimonials");
    revalidatePath("/");
}
