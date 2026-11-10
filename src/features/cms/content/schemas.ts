import { z } from "zod";

/**
 * Zod schemas, limits and small pure helpers for the Content Editor (Session 11).
 *
 * Everything here is plain text only. Legacy rows already in the database are over some of these limits,
 * so these schemas are applied ONLY to what the editor submits on create/update/saveDraft. The publish,
 * hide, unhide and restore actions never run the text schemas again.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const LIMITS = {
    service: { title: 40, description: 160, inclusionItems: 12, inclusionLength: 80 },
    portfolio: {
        title: 80,
        summary: 200,
        content: 4000,
        clientName: 80,
        clientDisplayName: 60,
        images: 5,
        technologies: 12,
        technologyLength: 30,
        liveUrl: 300,
    },
    home: { heading: 60, intro: 160, featured: 3 },
    about: { heading: 60, story: 600, mission: 300, vision: 300, howWeWork: 160, team: 12, name: 60, jobTitle: 60 },
    contact: { heading: 60, intro: 160, address: 160, officeHours: 120, phone: 40 },
} as const;

export const CONTENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const DEFAULT_CLIENT_DISPLAY_NAME = "Confidential client";

export const PAGE_SLUGS = ["home", "about", "contact"] as const;
export const pageSlugSchema = z.enum(PAGE_SLUGS);
export type PageSlugValue = z.infer<typeof pageSlugSchema>;

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export type ContentFailure = { error: string; fieldErrors?: Record<string, string> };

export function toFieldErrors(error: z.ZodError): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = issue.path.map(String).join(".") || "_";
        if (!(key in out)) out[key] = issue.message;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Slugs (pure)
// ---------------------------------------------------------------------------

export function slugify(input: string, fallback = "item"): string {
    const slug = input
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "");
    return slug || fallback;
}

/** `base`, or `base-2`, `base-3`, ... the first one that is not in `taken`. */
export function pickUniqueSlug(base: string, taken: Iterable<string | null | undefined>): string {
    const used = new Set<string>();
    for (const slug of taken) if (slug) used.add(slug);
    if (!used.has(base)) return base;
    for (let n = 2; ; n += 1) {
        const candidate = `${base}-${n}`;
        if (!used.has(candidate)) return candidate;
    }
}

export function isUniqueViolation(error: unknown): boolean {
    const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
        ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
    return code === "23505";
}

// ---------------------------------------------------------------------------
// Image URLs and files
// ---------------------------------------------------------------------------

const BLOB_CONTENT_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/content\/[A-Za-z0-9._-]+\.(jpg|png)$/;
const LOCAL_CONTENT_URL = /^\/uploads\/content\/[A-Za-z0-9._-]+\.(jpg|png)$/;

/** True when the URL was produced by `uploadContentImage` (Vercel Blob public, or the local dev folder). */
export function isOwnContentImageUrl(url: string): boolean {
    return BLOB_CONTENT_URL.test(url) || LOCAL_CONTENT_URL.test(url);
}

/** JPEG (FF D8 FF) or PNG (89 50 4E 47). Anything else, including SVG, GIF and WebP, is rejected. */
export function detectContentImageType(bytes: Uint8Array): "jpg" | "png" | null {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
    return null;
}

export type ImageFileCheck =
    | { ok: true; type: "jpg" | "png" }
    | { ok: false; error: "FILE_REQUIRED" | "FILE_TOO_LARGE" | "INVALID_FILE_TYPE" };

/** Size by `file.size` AND by the real byte length, plus magic bytes. */
export function checkContentImage(input: { size: number; bytes: Uint8Array }): ImageFileCheck {
    if (!input.size || input.bytes.length === 0) return { ok: false, error: "FILE_REQUIRED" };
    if (input.size > CONTENT_IMAGE_MAX_BYTES || input.bytes.length > CONTENT_IMAGE_MAX_BYTES) {
        return { ok: false, error: "FILE_TOO_LARGE" };
    }
    const type = detectContentImageType(input.bytes);
    if (!type) return { ok: false, error: "INVALID_FILE_TYPE" };
    return { ok: true, type };
}

export type SchemaContext = {
    /** URLs already stored on the row. They stay valid when unchanged, even when they are not our uploads. */
    existingUrls?: readonly string[];
};

function imageUrl(ctx: SchemaContext, options: { httpsOnlyWhenExisting?: boolean } = {}) {
    const existing = new Set(ctx.existingUrls ?? []);
    return z
        .string()
        .trim()
        .max(500)
        .refine((value) => {
            if (isOwnContentImageUrl(value)) return true;
            if (!existing.has(value)) return false;
            return options.httpsOnlyWhenExisting ? value.startsWith("https://") : true;
        }, "Upload a JPG or PNG image");
}

// ---------------------------------------------------------------------------
// Text helpers (plain text only)
// ---------------------------------------------------------------------------

const noMarkup = (value: string) => !/<[^>]*>/.test(value);
const PLAIN = "Plain text only";

function plain(max: number) {
    return z.string().trim().min(1, "Required").max(max, `At most ${max} characters`).refine(noMarkup, PLAIN);
}

function plainOptional(max: number) {
    return z.string().trim().max(max, `At most ${max} characters`).refine(noMarkup, PLAIN);
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

const optionalHttpUrl = z
    .string()
    .trim()
    .max(LIMITS.portfolio.liveUrl)
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isHttpUrl(value), "Must be an http(s) link");

const uniqueIds = (max: number) =>
    z
        .array(z.string().trim().min(1))
        .max(max, `At most ${max} items`)
        .refine((ids) => new Set(ids).size === ids.length, "Duplicate items");

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

const inclusionsSchema = z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
        if (value === undefined) return [] as string[];
        const lines = Array.isArray(value) ? value : value.split(/\r?\n/);
        return lines.map((line) => line.trim()).filter(Boolean);
    })
    .pipe(z.array(plain(LIMITS.service.inclusionLength)).max(LIMITS.service.inclusionItems));

export function serviceInputSchema(ctx: SchemaContext = {}) {
    return z.object({
        title: plain(LIMITS.service.title),
        description: plain(LIMITS.service.description),
        inclusions: inclusionsSchema,
        image: imageUrl(ctx).nullable().optional(),
        showOnServicesPage: z.boolean().default(true),
        showInInquiry: z.boolean().default(true),
        order: z.number().int().min(0).max(9999).optional(),
    });
}
export type ServiceInput = z.infer<ReturnType<typeof serviceInputSchema>>;

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export function portfolioInputSchema(ctx: SchemaContext = {}) {
    return z
        .object({
            title: plain(LIMITS.portfolio.title),
            serviceId: z.string().trim().min(1).nullable().optional(),
            summary: plain(LIMITS.portfolio.summary),
            content: plainOptional(LIMITS.portfolio.content).optional(),
            coverImage: imageUrl(ctx).nullable().optional(),
            galleryImages: z.array(imageUrl(ctx)).max(LIMITS.portfolio.images, `At most ${LIMITS.portfolio.images} images`).default([]),
            technologies: z
                .array(plain(LIMITS.portfolio.technologyLength))
                .max(LIMITS.portfolio.technologies)
                .default([]),
            liveUrl: optionalHttpUrl,
            clientName: plainOptional(LIMITS.portfolio.clientName).optional(),
            clientDisplayName: plainOptional(LIMITS.portfolio.clientDisplayName).optional(),
            clientConsent: z.boolean().default(false),
            sortOrder: z.number().int().min(0).max(9999).default(0),
        })
        .superRefine((value, refineCtx) => {
            if (value.clientConsent && !value.clientName?.trim()) {
                refineCtx.addIssue({
                    code: "custom",
                    path: ["clientName"],
                    message: "Enter the client's real name to show it with their consent",
                });
            }
        });
}
export type PortfolioInput = z.infer<ReturnType<typeof portfolioInputSchema>>;

/**
 * Publish rule (state check, not text validation):
 * consent given AND a real client name, OR consent not given AND a non-empty display name.
 */
export function canPublishPortfolio(row: {
    clientConsent: boolean;
    clientName?: string | null;
    clientDisplayName?: string | null;
}): boolean {
    const hasName = !!row.clientName?.trim();
    const hasDisplay = !!row.clientDisplayName?.trim();
    return row.clientConsent ? hasName : hasDisplay;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export function homeFieldsSchema(ctx: SchemaContext = {}) {
    return z.object({
        heading: plain(LIMITS.home.heading),
        intro: plain(LIMITS.home.intro),
        mainImageUrl: z.union([z.literal(""), imageUrl(ctx)]),
        featuredServiceIds: uniqueIds(LIMITS.home.featured),
        featuredPortfolioIds: uniqueIds(LIMITS.home.featured),
    });
}

export function aboutFieldsSchema(ctx: SchemaContext = {}) {
    return z.object({
        heading: plain(LIMITS.about.heading),
        story: plain(LIMITS.about.story),
        mission: plainOptional(LIMITS.about.mission),
        vision: plainOptional(LIMITS.about.vision),
        howWeWork: plainOptional(LIMITS.about.howWeWork),
        team: z
            .array(
                z.object({
                    name: plain(LIMITS.about.name),
                    jobTitle: plain(LIMITS.about.jobTitle),
                    // Our upload prefix, or an unchanged existing https URL (e.g. the Google avatars from the backfill).
                    photoUrl: z.union([z.literal(""), imageUrl(ctx, { httpsOnlyWhenExisting: true })]),
                }),
            )
            .max(LIMITS.about.team, `At most ${LIMITS.about.team} people`),
    });
}

export function contactFieldsSchema() {
    return z.object({
        heading: plain(LIMITS.contact.heading),
        intro: plain(LIMITS.contact.intro),
        email: z.string().trim().max(120).pipe(z.email("Enter a valid email")),
        phone: z
            .string()
            .trim()
            .min(1, "Required")
            .max(LIMITS.contact.phone)
            .regex(/^[0-9+()\-.\s]{5,}$/, "Enter a valid phone number"),
        address: plain(LIMITS.contact.address),
        officeHours: plain(LIMITS.contact.officeHours),
    });
}

export type HomeFields = z.infer<ReturnType<typeof homeFieldsSchema>>;
export type AboutFields = z.infer<ReturnType<typeof aboutFieldsSchema>>;
export type ContactFields = z.infer<ReturnType<typeof contactFieldsSchema>>;
export type PageFieldsByStatus = { home: HomeFields; about: AboutFields; contact: ContactFields };

export function pageFieldsSchema(slug: PageSlugValue, ctx: SchemaContext = {}) {
    switch (slug) {
        case "home":
            return homeFieldsSchema(ctx);
        case "about":
            return aboutFieldsSchema(ctx);
        case "contact":
            return contactFieldsSchema();
    }
}

/** Every image URL a stored page already uses, so unchanged values stay valid on the next save. */
export function collectPageUrls(...stored: Array<Record<string, unknown> | null | undefined>): string[] {
    const urls: string[] = [];
    for (const fields of stored) {
        if (!fields) continue;
        if (typeof fields.mainImageUrl === "string" && fields.mainImageUrl) urls.push(fields.mainImageUrl);
        if (Array.isArray(fields.team)) {
            for (const member of fields.team) {
                const photo = (member as { photoUrl?: unknown } | null)?.photoUrl;
                if (typeof photo === "string" && photo) urls.push(photo);
            }
        }
    }
    return urls;
}

