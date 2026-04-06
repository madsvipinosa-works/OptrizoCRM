"use server";

import { db } from "@/db";
import { deleteImage } from "@/features/upload/actions";

import { siteSettings, posts, projects, services, testimonials } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import {
    siteSettingsSchema,
    postSchema,
    projectSchema,
    serviceSchema,
    testimonialSchema
} from "@/lib/schemas";

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
    return session; // Returning session to get user ID
}

// --- Global Settings ---

export async function getSiteSettings() {
    const settings = await db.query.siteSettings.findFirst();
    return settings;
}

export type ActionState = {
    message: string;
    success: boolean;
    errors?: Record<string, string[]>;
};
export async function updateSiteSettings(prevState: ActionState, formData: FormData) {
    try {
        await requireAdmin();

        const rawData = Object.fromEntries(formData);
        const validated = siteSettingsSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        await db.insert(siteSettings)
            .values({ id: "1", ...validated.data })
            .onConflictDoUpdate({
                target: siteSettings.id,
                set: validated.data,
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

        const rawData = Object.fromEntries(formData.entries());
        const validated = postSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        const { title, content, coverImage } = validated.data;
        let slug = validated.data.slug;

        if (!slug) slug = title;
        const sanitizedSlug = sanitizeSlug(slug!);

        const isPublished = session.user.role === "admin" && formData.get("published") === "true";

        await db.insert(posts).values({
            title,
            slug: sanitizedSlug,
            content,
            coverImage,
            authorId: session.user.id!,
            published: isPublished,
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

    // Get image URL before deleting
    const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
    if (post?.coverImage) {
        await deleteImage(post.coverImage);
    }

    await db.delete(posts).where(eq(posts.id, id));
    revalidatePath("/dashboard/posts");
}

export async function updatePost(prevState: ActionState, formData: FormData) {
    try {
        const session = await requireEditor();

        const rawData = Object.fromEntries(formData.entries());
        const validated = postSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        const { id, title, content, coverImage } = validated.data;
        let slug = validated.data.slug;

        if (!slug) slug = title;
        const sanitizedSlug = sanitizeSlug(slug!);

        if (!id) return { success: false, message: "Missing Post ID" };

        const isPublished = session.user.role === "admin" && formData.get("published") === "true";

        await db.update(posts)
            .set({
                title,
                slug: sanitizedSlug,
                content,
                coverImage,
                published: isPublished,
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

        const rawData = Object.fromEntries(formData.entries());
        const validated = projectSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        const { title, clientName, description, content, coverImage } = validated.data;
        let slug = validated.data.slug;

        if (!slug) slug = title;
        const sanitizedSlug = sanitizeSlug(slug!);

        await db.insert(projects).values({
            title,
            slug: sanitizedSlug,
            clientName,
            description,
            content,
            coverImage,
            status: "published",
        });

        revalidatePath("/dashboard/portfolio");
        return { success: true, message: "Project created successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed. " + (error as Error).message };
    }
}

export async function deleteProject(id: string) {
    await requireEditor();

    // Get image URL before deleting
    const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (project?.coverImage) {
        await deleteImage(project.coverImage);
    }

    await db.delete(projects).where(eq(projects.id, id));
    revalidatePath("/dashboard/portfolio");
}

export async function updateProject(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const rawData = Object.fromEntries(formData.entries());
        const validated = projectSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        const { id, title, clientName, description, content, coverImage } = validated.data;
        let slug = validated.data.slug;

        if (!slug) slug = title;
        const sanitizedSlug = sanitizeSlug(slug!);

        if (!id) return { success: false, message: "Missing Project ID" };

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

        revalidatePath("/dashboard/portfolio");
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

        const rawData = Object.fromEntries(formData.entries());
        const validated = serviceSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        const { title, description, icon } = validated.data;

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

        const rawData = Object.fromEntries(formData.entries());
        const validated = serviceSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        const { id, title, description, icon } = validated.data;

        if (!id) return { success: false, message: "Missing Service ID" };

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

        const rawData = Object.fromEntries(formData.entries());
        const validated = testimonialSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        const { name, role, company, content, rating, image } = validated.data;

        await db.insert(testimonials).values({
            name,
            role,
            company,
            content,
            rating,
            image,
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

        const rawData = Object.fromEntries(formData.entries());
        const validated = testimonialSchema.safeParse(rawData);

        if (!validated.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validated.error.flatten().fieldErrors,
            };
        }

        const { id, name, role, company, content, rating, image } = validated.data;

        if (!id) return { success: false, message: "Missing Testimonial ID" };

        await db.update(testimonials)
            .set({
                name,
                role,
                company,
                content,
                rating,
                active: true,
                image,
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

    // Get image URL before deleting
    const testimonial = await db.query.testimonials.findFirst({ where: eq(testimonials.id, id) });
    if (testimonial?.image) {
        await deleteImage(testimonial.image);
    }

    await db.delete(testimonials).where(eq(testimonials.id, id));
    revalidatePath("/dashboard/testimonials");
    revalidatePath("/");
}
