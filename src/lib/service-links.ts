/**
 * Public page of a service, e.g. `/services/web-development`. Returns null when there is no slug (the visitor
 * chose "Other"), so callers can hide the link instead of linking to the wrong page.
 */
export function servicePageHref(slug?: string | null): string | null {
    const clean = slug?.trim();
    if (!clean) return null;
    return `/services/${encodeURIComponent(clean)}`;
}
