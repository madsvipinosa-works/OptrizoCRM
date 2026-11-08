/**
 * Submitted work (step 25) may only point at a web page or a file served by /api/private-file.
 * Returns the safe URL to store and open, or null when it cannot be opened (e.g. "dada.png", "javascript:").
 */
export function normalizeProofUrl(raw: string | null | undefined): string | null {
    const value = (raw ?? "").trim();
    if (!value) return null;
    if (value.startsWith("/api/private-file?")) return value;
    if (value.startsWith("/")) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    try {
        const url = new URL(withScheme);
        // A bare word like "dada" is not a site: require a dot in the host.
        if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) return null;
        return url.toString();
    } catch {
        return null;
    }
}
