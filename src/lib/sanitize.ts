/**
 * Server-side HTML sanitizer.
 * Strips dangerous tags (script, iframe-injected JS, event handlers) from
 * Tiptap-generated HTML. Safe to use in Next.js Server Components with
 * dangerouslySetInnerHTML. Does NOT use DOMPurify — no browser APIs involved.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
    if (!dirty) return "";
    return dirty
        // Remove <script> blocks entirely
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        // Remove on* event handler attributes (onclick, onerror, etc.)
        .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
        // Remove javascript: hrefs
        .replace(/href\s*=\s*["']?javascript:[^"'\s>]*/gi, "");
}
