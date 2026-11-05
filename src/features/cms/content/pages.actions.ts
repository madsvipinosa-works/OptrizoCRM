"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { caseStudies, pages, pageVersions, services, siteSettings } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { insertContentAudit, type DbTx } from "./audit";
import { revalidateContentPaths } from "./revalidate";
import {
    collectPageUrls,
    pageFieldsSchema,
    pageSlugSchema,
    toFieldErrors,
    type AboutFields,
    type ContactFields,
    type ContentFailure,
    type HomeFields,
    type PageSlugValue,
} from "./schemas";

type PageOk = { ok: true; version: number; publishedAt?: Date; restoredFrom?: number };
type PageResult = PageOk | ContentFailure;

async function syncSiteSettings(tx: DbTx, slug: PageSlugValue, fields: Record<string, unknown>): Promise<void> {
    try {
        if (slug === "home") {
            const h = fields as unknown as HomeFields;
            await tx
                .update(siteSettings)
                .set({
                    heroTitle: h.heading,
                    heroDescription: h.intro,
                })
                .where(eq(siteSettings.id, "singleton_root"));
        } else if (slug === "about") {
            const a = fields as unknown as AboutFields;
            await tx
                .update(siteSettings)
                .set({
                    aboutHeroTitle: a.heading,
                    aboutText: a.story,
                    missionStatement: a.mission ?? null,
                })
                .where(eq(siteSettings.id, "singleton_root"));
        } else if (slug === "contact") {
            const c = fields as unknown as ContactFields;
            await tx
                .update(siteSettings)
                .set({
                    contactEmail: c.email,
                })
                .where(eq(siteSettings.id, "singleton_root"));
        }
    } catch (err) {
        // site_settings dual-write is best-effort sync for legacy readers
        console.warn("[content:pages] site_settings sync warning:", err);
    }
}

export async function getPageForEdit(slug: string) {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };

    const parsedSlug = pageSlugSchema.safeParse(slug);
    if (!parsedSlug.success) return { error: "INVALID_SLUG" };

    const [row] = await db.select().from(pages).where(eq(pages.slug, parsedSlug.data));
    if (!row) return { error: "NOT_FOUND" };

    return {
        ok: true as const,
        page: {
            slug: row.slug as PageSlugValue,
            fields: row.fields as Record<string, unknown>,
            draftFields: (row.draftFields as Record<string, unknown> | null) ?? null,
            status: row.status,
            version: row.version,
            publishedAt: row.publishedAt,
            publishedBy: row.publishedBy,
            draftUpdatedAt: row.draftUpdatedAt,
            draftUpdatedBy: row.draftUpdatedBy,
        },
    };
}

export async function saveDraft(slug: string, fields: unknown, baseVersion: number): Promise<PageResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };

    const parsedSlug = pageSlugSchema.safeParse(slug);
    if (!parsedSlug.success) return { error: "INVALID_SLUG" };

    try {
        const result = await db.transaction(async (tx): Promise<PageResult> => {
            const [row] = await tx.select().from(pages).where(eq(pages.slug, parsedSlug.data)).for("update");
            if (!row) return { error: "NOT_FOUND" };

            if (row.version !== baseVersion) {
                return { error: "CONFLICT" };
            }

            const existingUrls = collectPageUrls(
                row.fields as Record<string, unknown>,
                row.draftFields as Record<string, unknown>,
            );

            const parsed = pageFieldsSchema(parsedSlug.data, { existingUrls }).safeParse(fields);
            if (!parsed.success) {
                return { error: "VALIDATION_ERROR", fieldErrors: toFieldErrors(parsed.error) };
            }

            await tx
                .update(pages)
                .set({
                    draftFields: parsed.data as Record<string, unknown>,
                    draftUpdatedAt: new Date(),
                    draftUpdatedBy: a.session.user.id,
                })
                .where(eq(pages.slug, row.slug));

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Page",
                entityId: row.slug,
                action: "UPDATE",
                fromStatus: row.status,
                toStatus: row.status,
                extra: { version: row.version },
            });

            return { ok: true, version: row.version };
        });

        return result;
    } catch (error) {
        console.error("[content:pages:saveDraft]", error);
        return { error: "SERVER_ERROR" };
    }
}

export async function publishPage(slug: string, baseVersion: number): Promise<PageResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };

    const parsedSlug = pageSlugSchema.safeParse(slug);
    if (!parsedSlug.success) return { error: "INVALID_SLUG" };

    try {
        const result = await db.transaction(async (tx): Promise<PageResult> => {
            const [row] = await tx.select().from(pages).where(eq(pages.slug, parsedSlug.data)).for("update");
            if (!row) return { error: "NOT_FOUND" };

            if (row.version !== baseVersion) {
                return { error: "CONFLICT" };
            }

            const fieldsToPublish = (row.draftFields ?? row.fields) as Record<string, unknown> | null;
            if (!fieldsToPublish) {
                return { error: "NO_DRAFT" };
            }

            // Featured ids validation for home page: all featured items must exist and be published
            if (parsedSlug.data === "home") {
                const homeFields = fieldsToPublish as unknown as HomeFields;
                if (homeFields.featuredServiceIds && homeFields.featuredServiceIds.length > 0) {
                    const foundServices = await tx
                        .select({ id: services.id })
                        .from(services)
                        .where(
                            and(
                                inArray(services.id, homeFields.featuredServiceIds),
                                eq(services.status, "published"),
                            ),
                        );
                    if (foundServices.length !== homeFields.featuredServiceIds.length) {
                        return {
                            error: "FEATURED_NOT_PUBLISHED",
                        };
                    }
                }

                if (homeFields.featuredPortfolioIds && homeFields.featuredPortfolioIds.length > 0) {
                    const foundPortfolio = await tx
                        .select({ id: caseStudies.id })
                        .from(caseStudies)
                        .where(
                            and(
                                inArray(caseStudies.id, homeFields.featuredPortfolioIds),
                                eq(caseStudies.status, "published"),
                            ),
                        );
                    if (foundPortfolio.length !== homeFields.featuredPortfolioIds.length) {
                        return {
                            error: "FEATURED_NOT_PUBLISHED",
                        };
                    }
                }
            }

            const newVersion = row.version + 1;
            const now = new Date();

            await tx
                .update(pages)
                .set({
                    fields: fieldsToPublish,
                    draftFields: null,
                    status: "published",
                    version: newVersion,
                    publishedAt: now,
                    publishedBy: a.session.user.id,
                    draftUpdatedAt: null,
                    draftUpdatedBy: null,
                })
                .where(eq(pages.slug, row.slug));

            await tx.insert(pageVersions).values({
                id: crypto.randomUUID(),
                pageSlug: row.slug,
                versionNo: newVersion,
                fields: fieldsToPublish,
                action: "publish",
                restoredFrom: null,
                createdBy: a.session.user.id,
                createdAt: now,
            });

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Page",
                entityId: row.slug,
                action: "PUBLISH",
                fromStatus: row.status,
                toStatus: "published",
                extra: { version: newVersion },
            });

            await syncSiteSettings(tx, parsedSlug.data, fieldsToPublish);

            return { ok: true, version: newVersion, publishedAt: now };
        });

        if ("ok" in result) revalidateContentPaths();
        return result;
    } catch (error) {
        console.error("[content:pages:publishPage]", error);
        return { error: "SERVER_ERROR" };
    }
}

export async function restoreVersion(
    slug: string,
    versionNo: number,
    baseVersion: number,
    discardDraft?: boolean,
): Promise<PageResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };

    const parsedSlug = pageSlugSchema.safeParse(slug);
    if (!parsedSlug.success) return { error: "INVALID_SLUG" };

    try {
        const result = await db.transaction(async (tx): Promise<PageResult> => {
            const [row] = await tx.select().from(pages).where(eq(pages.slug, parsedSlug.data)).for("update");
            if (!row) return { error: "NOT_FOUND" };

            if (row.version !== baseVersion) {
                return { error: "CONFLICT" };
            }

            if (row.draftFields !== null && !discardDraft) {
                return { error: "DRAFT_EXISTS" };
            }

            const [versionRow] = await tx
                .select()
                .from(pageVersions)
                .where(and(eq(pageVersions.pageSlug, parsedSlug.data), eq(pageVersions.versionNo, versionNo)));
            if (!versionRow) {
                return { error: "VERSION_NOT_FOUND" };
            }

            const newVersion = row.version + 1;
            const now = new Date();
            const fieldsToRestore = versionRow.fields as Record<string, unknown>;

            await tx
                .update(pages)
                .set({
                    fields: fieldsToRestore,
                    draftFields: null,
                    status: "published",
                    version: newVersion,
                    publishedAt: now,
                    publishedBy: a.session.user.id,
                    draftUpdatedAt: null,
                    draftUpdatedBy: null,
                })
                .where(eq(pages.slug, row.slug));

            await tx.insert(pageVersions).values({
                id: crypto.randomUUID(),
                pageSlug: row.slug,
                versionNo: newVersion,
                fields: fieldsToRestore,
                action: "restore",
                restoredFrom: versionNo,
                createdBy: a.session.user.id,
                createdAt: now,
            });

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Page",
                entityId: row.slug,
                action: "RESTORE",
                fromStatus: row.status,
                toStatus: "published",
                extra: { version: newVersion, restoredFrom: versionNo },
            });

            await syncSiteSettings(tx, parsedSlug.data, fieldsToRestore);

            return { ok: true, version: newVersion, restoredFrom: versionNo };
        });

        if ("ok" in result) revalidateContentPaths();
        return result;
    } catch (error) {
        console.error("[content:pages:restoreVersion]", error);
        return { error: "SERVER_ERROR" };
    }
}

export async function listVersions(slug: string) {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };

    const parsedSlug = pageSlugSchema.safeParse(slug);
    if (!parsedSlug.success) return { error: "INVALID_SLUG" };

    const rows = await db
        .select()
        .from(pageVersions)
        .where(eq(pageVersions.pageSlug, parsedSlug.data))
        .orderBy(desc(pageVersions.versionNo));

    return {
        ok: true as const,
        versions: rows.map((r) => ({
            id: r.id,
            versionNo: r.versionNo,
            action: r.action,
            restoredFrom: r.restoredFrom,
            createdBy: r.createdBy,
            createdAt: r.createdAt,
        })),
    };
}
