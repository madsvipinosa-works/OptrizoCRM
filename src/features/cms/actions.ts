"use server";

import { db } from "@/db";
import { deleteImage } from "@/features/upload/actions";

import { siteSettings, posts, caseStudies, services, testimonials } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and, ne } from "drizzle-orm";
import { auth, requireRole, hasRole } from "@/auth";
import { sanitizeHtml } from "@/lib/sanitize";
import {
    siteSettingsSchema,
    postSchema,
    caseStudySchema,
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
    requireRole(session, ["superadmin"]);
    return session;
}

async function requireEditor() {
    const session = await auth();
    requireRole(session, ["superadmin", "content_editor"]);
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

        const notificationEmailsList = validated.data.notificationEmails
            ? validated.data.notificationEmails.split(',').map(e => e.trim()).filter(Boolean)
            : [];

        const payload = {
            ...validated.data,
            notificationEmails: notificationEmailsList,
        };

        await db.insert(siteSettings)
            .values({ id: "singleton_root", ...payload })
            .onConflictDoUpdate({
                target: siteSettings.id,
                set: payload,
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
        const sanitizedContent = content ? sanitizeHtml(content) : content;

        const isPublished = hasRole(session, ["superadmin"]) && formData.get("published") === "true";

        await db.insert(posts).values({
            title,
            slug: sanitizedSlug,
            content: sanitizedContent,
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
        const sanitizedContent = content ? sanitizeHtml(content) : content;

        if (!id) return { success: false, message: "Missing Post ID" };

        const isPublished = hasRole(session, ["superadmin"]) && formData.get("published") === "true";

        await db.update(posts)
            .set({
                title,
                slug: sanitizedSlug,
                content: sanitizedContent,
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

// --- Case Studies (Portfolio Projects) ---

export async function createCaseStudy(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const rawData = Object.fromEntries(formData.entries());
        const validated = (caseStudySchema || projectSchema).safeParse(rawData);

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
        const sanitizedContent = content ? sanitizeHtml(content) : content;

        await db.insert(caseStudies).values({
            title,
            slug: sanitizedSlug,
            clientName,
            description,
            content: sanitizedContent,
            coverImage,
            published: true,
        });

        revalidatePath("/dashboard/portfolio");
        revalidatePath("/projects");
        return { success: true, message: "Case study created successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed. " + (error as Error).message };
    }
}
export const createProject = createCaseStudy;

export async function deleteCaseStudy(id: string) {
    await requireEditor();

    // Get image URL before deleting
    const caseStudy = await db.query.caseStudies.findFirst({ where: eq(caseStudies.id, id) });
    if (caseStudy?.coverImage) {
        await deleteImage(caseStudy.coverImage);
    }

    await db.delete(caseStudies).where(eq(caseStudies.id, id));
    revalidatePath("/dashboard/portfolio");
    revalidatePath("/projects");
}
export const deleteProject = deleteCaseStudy;

export async function updateCaseStudy(prevState: ActionState, formData: FormData) {
    try {
        await requireEditor();

        const rawData = Object.fromEntries(formData.entries());
        const validated = (caseStudySchema || projectSchema).safeParse(rawData);

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
        const sanitizedContent = content ? sanitizeHtml(content) : content;

        if (!id) return { success: false, message: "Missing Case Study ID" };

        await db.update(caseStudies)
            .set({
                title,
                slug: sanitizedSlug,
                clientName,
                description,
                content: sanitizedContent,
                coverImage,
                published: true,
                updatedAt: new Date(),
            })
            .where(eq(caseStudies.id, id));

        revalidatePath("/dashboard/portfolio");
        revalidatePath(`/projects/${sanitizedSlug}`);
        return { success: true, message: "Case study updated successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed. " + (error as Error).message };
    }
}
export const updateProject = updateCaseStudy;

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

        const { title, description, category, image, color, link, icon, order, isFeatured } = validated.data;

        if (isFeatured) {
            const featured = await db.query.services.findMany({
                where: eq(services.isFeatured, true),
            });
            if (featured.length >= 4) {
                return {
                    success: false,
                    message: "You can only feature up to 4 services on the landing page. Please unselect another service first.",
                };
            }
        }

        await db.insert(services).values({
            title,
            description,
            category,
            image,
            color: color || "#05160b",
            link: link || "/contact",
            icon,
            order: order ?? 0,
            isFeatured: isFeatured ?? false,
        });

        revalidatePath("/dashboard/services");
        revalidatePath("/dashboard/cms");
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

        const { id, title, description, category, image, color, link, icon, order, isFeatured } = validated.data;

        if (!id) return { success: false, message: "Missing Service ID" };

        if (isFeatured) {
            const otherFeatured = await db.query.services.findMany({
                where: and(eq(services.isFeatured, true), ne(services.id, id)),
            });
            if (otherFeatured.length >= 4) {
                return {
                    success: false,
                    message: "You can only feature up to 4 services on the landing page. Please unselect another service first.",
                };
            }
        }

        await db.update(services)
            .set({
                title,
                description,
                category,
                image,
                color: color || "#05160b",
                link: link || "/contact",
                icon,
                order: order ?? 0,
                isFeatured: isFeatured ?? false,
            })
            .where(eq(services.id, id));

        revalidatePath("/dashboard/services");
        revalidatePath("/dashboard/cms");
        revalidatePath("/");
        return { success: true, message: "Service updated successfully!" };
    } catch (error) {
        console.error(error);
        return { success: false, message: "Failed to update service." };
    }
}

export async function toggleServiceFeatured(id: string, isFeatured: boolean) {
    try {
        await requireEditor();

        if (isFeatured) {
            const otherFeatured = await db.query.services.findMany({
                where: and(eq(services.isFeatured, true), ne(services.id, id)),
            });
            if (otherFeatured.length >= 4) {
                return {
                    success: false,
                    message: "Maximum of 4 services can be displayed on the landing page. Please unselect another service first.",
                };
            }
        }

        await db.update(services)
            .set({ isFeatured })
            .where(eq(services.id, id));

        revalidatePath("/dashboard/services");
        revalidatePath("/dashboard/cms");
        revalidatePath("/");

        return {
            success: true,
            message: isFeatured
                ? "Service selected for landing page display (up to 4 max)."
                : "Service removed from landing page display.",
        };
    } catch (error) {
        console.error("Failed to toggle service featured status:", error);
        return { success: false, message: "Failed to update service featured status." };
    }
}

export async function deleteService(id: string) {
    await requireEditor();
    await db.delete(services).where(eq(services.id, id));
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/cms");
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
