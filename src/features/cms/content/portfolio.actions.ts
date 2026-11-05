"use server";

import { eq, like, or } from "drizzle-orm";
import { db } from "@/db";
import { caseStudies, services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { insertContentAudit, type DbTx } from "./audit";
import { revalidateContentPaths } from "./revalidate";
import {
    canPublishPortfolio,
    DEFAULT_CLIENT_DISPLAY_NAME,
    isUniqueViolation,
    pickUniqueSlug,
    portfolioInputSchema,
    slugify,
    toFieldErrors,
    type ContentFailure,
} from "./schemas";

type PortfolioStatus = "draft" | "published" | "hidden";
type PortfolioOk = { ok: true; id: string; status: PortfolioStatus; slug: string };
type PortfolioResult = PortfolioOk | ContentFailure;

async function takenPortfolioSlugs(tx: DbTx, base: string, excludeId?: string): Promise<string[]> {
    const rows = await tx
        .select({ id: caseStudies.id, slug: caseStudies.slug })
        .from(caseStudies)
        .where(or(eq(caseStudies.slug, base), like(caseStudies.slug, `${base}-%`)));
    return rows.filter((row) => row.id !== excludeId).map((row) => row.slug ?? "");
}

async function uniquePortfolioSlug(tx: DbTx, title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, "project");
    return pickUniqueSlug(base, await takenPortfolioSlugs(tx, base, excludeId));
}

function failureFrom(error: unknown): ContentFailure {
    if (isUniqueViolation(error)) return { error: "SLUG_TAKEN" };
    console.error("[content:portfolio]", error);
    return { error: "SERVER_ERROR" };
}

export async function createPortfolio(input: unknown): Promise<PortfolioResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };

    const parsed = portfolioInputSchema().safeParse(input);
    if (!parsed.success) return { error: "VALIDATION_ERROR", fieldErrors: toFieldErrors(parsed.error) };
    const data = parsed.data;

    try {
        const created = await db.transaction(async (tx) => {
            if (data.serviceId) {
                const [svc] = await tx
                    .select({ id: services.id })
                    .from(services)
                    .where(eq(services.id, data.serviceId));
                if (!svc) throw new Error("SERVICE_NOT_FOUND");
            }

            const slug = await uniquePortfolioSlug(tx, data.title);
            const [row] = await tx
                .insert(caseStudies)
                .values({
                    title: data.title,
                    slug,
                    serviceId: data.serviceId ?? null,
                    summary: data.summary,
                    description: data.summary, // legacy mirror
                    content: data.content ?? null,
                    coverImage: data.coverImage ?? null,
                    galleryImages: data.galleryImages,
                    technologies: data.technologies,
                    liveUrl: data.liveUrl ?? null,
                    clientName: data.clientName ?? null,
                    clientDisplayName: data.clientDisplayName ?? DEFAULT_CLIENT_DISPLAY_NAME,
                    clientConsent: data.clientConsent,
                    sortOrder: data.sortOrder,
                    status: "draft",
                    published: false,
                    updatedBy: a.session.user.id,
                })
                .returning({ id: caseStudies.id });

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Portfolio",
                entityId: row.id,
                action: "CREATE",
                fromStatus: null,
                toStatus: "draft",
            });

            return { id: row.id, slug };
        });

        revalidateContentPaths();
        return { ok: true, id: created.id, status: "draft", slug: created.slug };
    } catch (error) {
        if ((error as Error)?.message === "SERVICE_NOT_FOUND") {
            return { error: "SERVICE_NOT_FOUND" };
        }
        return failureFrom(error);
    }
}

export async function updatePortfolio(id: string, input: unknown): Promise<PortfolioResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };
    if (typeof id !== "string" || !id) return { error: "NOT_FOUND" };

    try {
        const result = await db.transaction(async (tx): Promise<PortfolioResult> => {
            const [row] = await tx.select().from(caseStudies).where(eq(caseStudies.id, id)).for("update");
            if (!row) return { error: "NOT_FOUND" };

            const existingUrls = [row.coverImage, ...(Array.isArray(row.galleryImages) ? row.galleryImages : [])].filter(
                (u): u is string => typeof u === "string" && !!u,
            );

            const parsed = portfolioInputSchema({ existingUrls }).safeParse(input);
            if (!parsed.success) return { error: "VALIDATION_ERROR", fieldErrors: toFieldErrors(parsed.error) };
            const data = parsed.data;

            if (data.serviceId) {
                const [svc] = await tx
                    .select({ id: services.id })
                    .from(services)
                    .where(eq(services.id, data.serviceId));
                if (!svc) return { error: "SERVICE_NOT_FOUND" };
            }

            const neverPublished = row.status === "draft" && !row.publishedAt;
            let slug = row.slug;
            if (!slug || (neverPublished && data.title !== row.title)) {
                slug = await uniquePortfolioSlug(tx, data.title, row.id);
            }

            await tx
                .update(caseStudies)
                .set({
                    title: data.title,
                    slug,
                    serviceId: data.serviceId ?? null,
                    summary: data.summary,
                    description: data.summary,
                    content: data.content ?? null,
                    coverImage: data.coverImage ?? null,
                    galleryImages: data.galleryImages,
                    technologies: data.technologies,
                    liveUrl: data.liveUrl ?? null,
                    clientName: data.clientName ?? null,
                    clientDisplayName: data.clientDisplayName ?? DEFAULT_CLIENT_DISPLAY_NAME,
                    clientConsent: data.clientConsent,
                    sortOrder: data.sortOrder,
                    updatedBy: a.session.user.id,
                    updatedAt: new Date(),
                })
                .where(eq(caseStudies.id, row.id));

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Portfolio",
                entityId: row.id,
                action: "UPDATE",
                fromStatus: row.status,
                toStatus: row.status,
            });

            return { ok: true, id: row.id, status: row.status, slug };
        });

        if ("ok" in result) revalidateContentPaths();
        return result;
    } catch (error) {
        return failureFrom(error);
    }
}

export async function publishPortfolio(id: string): Promise<PortfolioResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };
    if (typeof id !== "string" || !id) return { error: "NOT_FOUND" };

    try {
        const result = await db.transaction(async (tx): Promise<PortfolioResult> => {
            const [row] = await tx.select().from(caseStudies).where(eq(caseStudies.id, id)).for("update");
            if (!row) return { error: "NOT_FOUND" };
            if (row.status !== "draft") return { error: "INVALID_STATUS" };

            // 1. Consent check: consent requires real clientName; no consent requires clientDisplayName
            if (!canPublishPortfolio(row)) {
                return {
                    error: "CONSENT_REQUIRED",
                };
            }

            // 2. Linked service must exist
            if (!row.serviceId) {
                return { error: "SERVICE_REQUIRED" };
            }
            const [svc] = await tx
                .select({ id: services.id })
                .from(services)
                .where(eq(services.id, row.serviceId));
            if (!svc) {
                return { error: "SERVICE_NOT_FOUND" };
            }

            const now = new Date();
            let slug = row.slug;
            if (!slug) {
                slug = await uniquePortfolioSlug(tx, row.title, row.id);
            }

            await tx
                .update(caseStudies)
                .set({
                    status: "published",
                    published: true,
                    slug,
                    publishedAt: row.publishedAt ?? now,
                    updatedAt: now,
                    updatedBy: a.session.user.id,
                })
                .where(eq(caseStudies.id, row.id));

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Portfolio",
                entityId: row.id,
                action: "PUBLISH",
                fromStatus: row.status,
                toStatus: "published",
            });

            return { ok: true, id: row.id, status: "published", slug };
        });

        if ("ok" in result) revalidateContentPaths();
        return result;
    } catch (error) {
        return failureFrom(error);
    }
}

export async function hidePortfolio(id: string): Promise<PortfolioResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };
    if (typeof id !== "string" || !id) return { error: "NOT_FOUND" };

    try {
        const result = await db.transaction(async (tx): Promise<PortfolioResult> => {
            const [row] = await tx.select().from(caseStudies).where(eq(caseStudies.id, id)).for("update");
            if (!row) return { error: "NOT_FOUND" };
            if (row.status !== "published") return { error: "INVALID_STATUS" };

            const now = new Date();
            await tx
                .update(caseStudies)
                .set({
                    status: "hidden",
                    published: false,
                    updatedAt: now,
                    updatedBy: a.session.user.id,
                })
                .where(eq(caseStudies.id, row.id));

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Portfolio",
                entityId: row.id,
                action: "HIDE",
                fromStatus: row.status,
                toStatus: "hidden",
            });

            return { ok: true, id: row.id, status: "hidden", slug: row.slug };
        });

        if ("ok" in result) revalidateContentPaths();
        return result;
    } catch (error) {
        return failureFrom(error);
    }
}

export async function unhidePortfolio(id: string): Promise<PortfolioResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };
    if (typeof id !== "string" || !id) return { error: "NOT_FOUND" };

    try {
        const result = await db.transaction(async (tx): Promise<PortfolioResult> => {
            const [row] = await tx.select().from(caseStudies).where(eq(caseStudies.id, id)).for("update");
            if (!row) return { error: "NOT_FOUND" };
            if (row.status !== "hidden") return { error: "INVALID_STATUS" };

            if (!canPublishPortfolio(row)) {
                return { error: "CONSENT_REQUIRED" };
            }
            if (!row.serviceId) {
                return { error: "SERVICE_REQUIRED" };
            }
            const [svc] = await tx
                .select({ id: services.id })
                .from(services)
                .where(eq(services.id, row.serviceId));
            if (!svc) {
                return { error: "SERVICE_NOT_FOUND" };
            }

            const now = new Date();
            await tx
                .update(caseStudies)
                .set({
                    status: "published",
                    published: true,
                    publishedAt: row.publishedAt ?? now,
                    updatedAt: now,
                    updatedBy: a.session.user.id,
                })
                .where(eq(caseStudies.id, row.id));

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Portfolio",
                entityId: row.id,
                action: "UNHIDE",
                fromStatus: row.status,
                toStatus: "published",
            });

            return { ok: true, id: row.id, status: "published", slug: row.slug };
        });

        if ("ok" in result) revalidateContentPaths();
        return result;
    } catch (error) {
        return failureFrom(error);
    }
}
