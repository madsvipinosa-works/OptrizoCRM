import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { caseStudies, pages, services } from "@/db/schema";
import type { HomeFields, PageSlugValue } from "./schemas";

/**
 * Public queries for Content Editor managed tables (Session 11).
 *
 * This is the ONLY module public code will use to read services, portfolio items, and pages.
 * All queries strictly filter by `status = 'published'`.
 */

// ---------------------------------------------------------------------------
// Where builders (exported for vitest assertions)
// ---------------------------------------------------------------------------

export function buildPublishedServicesWhere(options: { forInquiry?: boolean } = {}) {
    const conditions = [eq(services.status, "published")];
    if (options.forInquiry) {
        conditions.push(eq(services.showInInquiry, true));
    } else {
        conditions.push(eq(services.showOnServicesPage, true));
    }
    return and(...conditions);
}

export function buildPublishedServiceBySlugWhere(slug: string) {
    return and(eq(services.status, "published"), eq(services.slug, slug));
}

export function buildPublishedPortfolioWhere() {
    return eq(caseStudies.status, "published");
}

export function buildPublishedPortfolioBySlugWhere(slug: string) {
    return and(eq(caseStudies.status, "published"), eq(caseStudies.slug, slug));
}

export function buildPublishedPageWhere(slug: string) {
    return and(eq(pages.status, "published"), eq(pages.slug, slug));
}

// ---------------------------------------------------------------------------
// Portfolio mapper
// ---------------------------------------------------------------------------

export type PublicPortfolioItem = {
    id: string;
    title: string;
    slug: string;
    summary: string;
    content: string | null;
    serviceId: string | null;
    clientDisplayName: string;
    clientConsent: boolean;
    coverImage: string | null;
    galleryImages: string[];
    technologies: string[];
    liveUrl: string | null;
    sortOrder: number;
    publishedAt: Date | null;
};

/**
 * Maps a database case study row into a public portfolio item.
 * Security boundary: `clientName` is NEVER exposed or returned when `clientConsent` is false.
 */
export function mapPublicPortfolio(row: {
    id: string;
    title: string;
    slug: string;
    summary?: string | null;
    description?: string | null;
    content?: string | null;
    serviceId?: string | null;
    clientName?: string | null;
    clientDisplayName?: string | null;
    clientConsent?: boolean | null;
    coverImage?: string | null;
    galleryImages?: unknown;
    technologies?: unknown;
    liveUrl?: string | null;
    sortOrder?: number | null;
    publishedAt?: Date | null;
}): PublicPortfolioItem {
    const consent = Boolean(row.clientConsent);
    const resolvedName = consent ? row.clientName : row.clientDisplayName;

    return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        summary: row.summary ?? row.description ?? "",
        content: row.content ?? null,
        serviceId: row.serviceId ?? null,
        clientDisplayName: resolvedName?.trim() || "Confidential client",
        clientConsent: consent,
        coverImage: row.coverImage ?? null,
        galleryImages: Array.isArray(row.galleryImages) ? (row.galleryImages as string[]) : [],
        technologies: Array.isArray(row.technologies) ? (row.technologies as string[]) : [],
        liveUrl: row.liveUrl ?? null,
        sortOrder: row.sortOrder ?? 0,
        publishedAt: row.publishedAt ?? null,
    };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getPublishedServices(options: { forInquiry?: boolean } = {}) {
    const where = buildPublishedServicesWhere(options);
    const rows = await db
        .select()
        .from(services)
        .where(where)
        .orderBy(asc(services.order), desc(services.createdAt));
    return rows;
}

export async function getPublishedServiceBySlug(slug: string) {
    if (!slug) return null;
    const where = buildPublishedServiceBySlugWhere(slug);
    const [row] = await db.select().from(services).where(where);
    return row ?? null;
}

export async function getPublishedPortfolio() {
    const where = buildPublishedPortfolioWhere();
    const rows = await db
        .select()
        .from(caseStudies)
        .where(where)
        .orderBy(asc(caseStudies.sortOrder), desc(caseStudies.publishedAt), desc(caseStudies.createdAt));
    return rows.map(mapPublicPortfolio);
}

export async function getPublishedPortfolioBySlug(slug: string) {
    if (!slug) return null;
    const where = buildPublishedPortfolioBySlugWhere(slug);
    const [row] = await db.select().from(caseStudies).where(where);
    return row ? mapPublicPortfolio(row) : null;
}

export async function getPublishedPage(slug: PageSlugValue) {
    const where = buildPublishedPageWhere(slug);
    const [row] = await db.select().from(pages).where(where);
    if (!row) return null;

    const fields = row.fields as Record<string, unknown>;

    if (slug === "home") {
        const h = fields as unknown as HomeFields;
        const featuredServiceIds = Array.isArray(h.featuredServiceIds) ? h.featuredServiceIds : [];
        const featuredPortfolioIds = Array.isArray(h.featuredPortfolioIds) ? h.featuredPortfolioIds : [];

        let featuredServices: (typeof services.$inferSelect)[] = [];
        if (featuredServiceIds.length > 0) {
            const found = await db
                .select()
                .from(services)
                .where(and(inArray(services.id, featuredServiceIds), eq(services.status, "published")));
            const map = new Map(found.map((s) => [s.id, s]));
            featuredServices = featuredServiceIds
                .map((id) => map.get(id))
                .filter((s): s is typeof services.$inferSelect => Boolean(s));
        }

        let featuredPortfolio: PublicPortfolioItem[] = [];
        if (featuredPortfolioIds.length > 0) {
            const found = await db
                .select()
                .from(caseStudies)
                .where(and(inArray(caseStudies.id, featuredPortfolioIds), eq(caseStudies.status, "published")));
            const mapped = found.map(mapPublicPortfolio);
            const map = new Map(mapped.map((p) => [p.id, p]));
            featuredPortfolio = featuredPortfolioIds
                .map((id) => map.get(id))
                .filter((p): p is PublicPortfolioItem => Boolean(p));
        }

        return {
            slug: "home" as const,
            version: row.version,
            publishedAt: row.publishedAt,
            fields: {
                ...h,
                featuredServices,
                featuredPortfolio,
            },
        };
    }

    return {
        slug,
        version: row.version,
        publishedAt: row.publishedAt,
        fields,
    };
}
