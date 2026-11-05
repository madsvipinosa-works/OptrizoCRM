"use server";

import { eq, like, or } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { insertContentAudit, type DbTx } from "./audit";
import { revalidateContentPaths } from "./revalidate";
import {
    isUniqueViolation,
    pickUniqueSlug,
    serviceInputSchema,
    slugify,
    toFieldErrors,
    type ContentFailure,
} from "./schemas";

/**
 * Content Editor: services. Only `content_editor` may call these (spec 1 and 7).
 * There is deliberately NO delete action: leads reference services, and the six presets can only be hidden.
 * Slugs are generated on the server, de-duplicated inside the transaction, and frozen once published.
 */

type ServiceStatus = "draft" | "published" | "hidden";
type ServiceOk = { ok: true; id: string; status: ServiceStatus; slug: string };
type ServiceResult = ServiceOk | ContentFailure;

async function takenSlugs(tx: DbTx, base: string, excludeId?: string): Promise<string[]> {
    const rows = await tx
        .select({ id: services.id, slug: services.slug })
        .from(services)
        .where(or(eq(services.slug, base), like(services.slug, `${base}-%`)));
    return rows.filter((row) => row.id !== excludeId).map((row) => row.slug ?? "");
}

async function uniqueServiceSlug(tx: DbTx, title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, "service");
    return pickUniqueSlug(base, await takenSlugs(tx, base, excludeId));
}

function failureFrom(error: unknown): ContentFailure {
    if (isUniqueViolation(error)) return { error: "SLUG_TAKEN" };
    console.error("[content:services]", error);
    return { error: "SERVER_ERROR" };
}

export async function createService(input: unknown): Promise<ServiceResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };

    const parsed = serviceInputSchema().safeParse(input);
    if (!parsed.success) return { error: "VALIDATION_ERROR", fieldErrors: toFieldErrors(parsed.error) };
    const data = parsed.data;

    try {
        const created = await db.transaction(async (tx) => {
            const slug = await uniqueServiceSlug(tx, data.title);
            const [row] = await tx
                .insert(services)
                .values({
                    title: data.title,
                    description: data.description,
                    inclusions: data.inclusions,
                    image: data.image ?? null,
                    showOnServicesPage: data.showOnServicesPage,
                    showInInquiry: data.showInInquiry,
                    ...(data.order !== undefined ? { order: data.order } : {}),
                    slug,
                    status: "draft",
                    isPreset: false,
                })
                .returning({ id: services.id });

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Service",
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
        return failureFrom(error);
    }
}

export async function updateService(id: string, input: unknown): Promise<ServiceResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };
    if (typeof id !== "string" || !id) return { error: "NOT_FOUND" };

    try {
        const result = await db.transaction(async (tx): Promise<ServiceResult> => {
            const [row] = await tx.select().from(services).where(eq(services.id, id)).for("update");
            if (!row) return { error: "NOT_FOUND" };

            const parsed = serviceInputSchema({ existingUrls: row.image ? [row.image] : [] }).safeParse(input);
            if (!parsed.success) return { error: "VALIDATION_ERROR", fieldErrors: toFieldErrors(parsed.error) };
            const data = parsed.data;

            // The slug is frozen once the service has been published.
            const neverPublished = row.status === "draft" && !row.publishedAt;
            let slug = row.slug;
            if (!slug || (neverPublished && data.title !== row.title)) {
                slug = await uniqueServiceSlug(tx, data.title, row.id);
            }

            await tx
                .update(services)
                .set({
                    title: data.title,
                    description: data.description,
                    inclusions: data.inclusions,
                    image: data.image ?? null,
                    showOnServicesPage: data.showOnServicesPage,
                    showInInquiry: data.showInInquiry,
                    ...(data.order !== undefined ? { order: data.order } : {}),
                    slug,
                    updatedAt: new Date(),
                })
                .where(eq(services.id, row.id));

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Service",
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

/**
 * Status changes never re-validate text: legacy rows are over the new limits and must still publish,
 * hide and unhide.
 */
async function changeServiceStatus(
    id: string,
    spec: { allowedFrom: ServiceStatus[]; to: ServiceStatus; action: "PUBLISH" | "HIDE" | "UNHIDE" },
): Promise<ServiceResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { error: "FORBIDDEN" };
    if (typeof id !== "string" || !id) return { error: "NOT_FOUND" };

    try {
        const result = await db.transaction(async (tx): Promise<ServiceResult> => {
            const [row] = await tx.select().from(services).where(eq(services.id, id)).for("update");
            if (!row) return { error: "NOT_FOUND" };
            if (!spec.allowedFrom.includes(row.status)) return { error: "INVALID_STATUS" };

            const now = new Date();
            let slug = row.slug;
            const set: Partial<typeof services.$inferInsert> = { status: spec.to, updatedAt: now };
            if (spec.to === "published") {
                set.publishedAt = row.publishedAt ?? now;
                if (!slug) {
                    slug = await uniqueServiceSlug(tx, row.title, row.id);
                    set.slug = slug;
                }
            }
            await tx.update(services).set(set).where(eq(services.id, row.id));

            await insertContentAudit(tx, {
                actorId: a.session.user.id,
                actorRole: a.session.user.role,
                entity: "Service",
                entityId: row.id,
                action: spec.action,
                fromStatus: row.status,
                toStatus: spec.to,
            });
            return { ok: true, id: row.id, status: spec.to, slug: slug ?? "" };
        });

        if ("ok" in result) revalidateContentPaths();
        return result;
    } catch (error) {
        return failureFrom(error);
    }
}

export async function publishService(id: string): Promise<ServiceResult> {
    return changeServiceStatus(id, { allowedFrom: ["draft"], to: "published", action: "PUBLISH" });
}

export async function hideService(id: string): Promise<ServiceResult> {
    return changeServiceStatus(id, { allowedFrom: ["published"], to: "hidden", action: "HIDE" });
}

export async function unhideService(id: string): Promise<ServiceResult> {
    return changeServiceStatus(id, { allowedFrom: ["hidden"], to: "published", action: "UNHIDE" });
}

