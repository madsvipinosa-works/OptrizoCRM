import { normalizeProofUrl } from "@/lib/proof-url";
import type { TaskAttachment } from "@/db/schema";

export const MAX_ATTACHMENTS = 10;
export const MAX_LABEL_LENGTH = 120;
export const MAX_UPDATE_NOTE_LENGTH = 2000;

type Raw = { kind?: unknown; label?: unknown; url?: unknown };

/** The file name inside a /api/private-file URL, for a label when none was typed. */
export function fileNameFromUrl(url: string): string {
    try {
        const ref = new URL(url, "http://localhost").searchParams.get("blobUrl") ?? "";
        return decodeURIComponent(ref.split("/").pop() ?? "").replace(/^(\d+|[0-9a-f]{8}-[0-9a-f-]{27})-/i, "") || "File";
    } catch {
        return "File";
    }
}

/**
 * Checks what a PM or developer attached to a task. Links must open (https or http); files must be ones
 * uploaded for this project (a /api/private-file URL carrying the task's projectId), so a task cannot point at
 * another project's file. Returns the cleaned list, or the first problem.
 */
export function cleanTaskAttachments(
    input: unknown,
    projectId: string
): { ok: true; attachments: TaskAttachment[] } | { ok: false; error: string } {
    if (input === undefined || input === null) return { ok: true, attachments: [] };
    if (!Array.isArray(input)) return { ok: false, error: "Attachments must be a list." };
    if (input.length > MAX_ATTACHMENTS) return { ok: false, error: `Attach at most ${MAX_ATTACHMENTS} files or links.` };

    const attachments: TaskAttachment[] = [];
    for (const raw of input as Raw[]) {
        const kind = raw?.kind === "file" ? "file" : raw?.kind === "link" ? "link" : null;
        const url = normalizeProofUrl(typeof raw?.url === "string" ? raw.url : "");
        if (!kind || !url) return { ok: false, error: "One of the links cannot be opened. Use a full link such as https://example.com." };

        if (kind === "file") {
            const forProject = url.startsWith("/api/private-file?") && new URL(url, "http://localhost").searchParams.get("projectId") === projectId;
            if (!forProject) return { ok: false, error: "A file must be uploaded for this project." };
        } else if (url.startsWith("/api/private-file?")) {
            return { ok: false, error: "Upload files as files, not links." };
        }

        const label = (typeof raw.label === "string" ? raw.label.trim() : "").slice(0, MAX_LABEL_LENGTH);
        attachments.push({ kind, url, label: label || (kind === "file" ? fileNameFromUrl(url) : url) });
    }
    return { ok: true, attachments };
}

/** A progress note: trimmed, at most 2000 characters. Null when blank. */
export function cleanUpdateNote(note: unknown): string | null {
    const value = typeof note === "string" ? note.trim() : "";
    return value ? value.slice(0, MAX_UPDATE_NOTE_LENGTH) : null;
}
