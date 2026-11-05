"use server";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { checkContentImage } from "./schemas";

export type UploadContentImageResult =
    | { ok: true; url: string }
    | { ok: false; error: "FORBIDDEN" | "FILE_REQUIRED" | "FILE_TOO_LARGE" | "INVALID_FILE_TYPE" | "SERVER_ERROR" };

/**
 * Public image upload for the Content Editor (Session 11).
 *
 * Rules:
 * - Content Editor role only.
 * - JPG and PNG only (magic bytes inspection: FF D8 FF or 89 50 4E 47). No SVG, GIF, WebP.
 * - <= 2MB by `file.size` and real byte length.
 * - Server-generated random UUID filename (no client filename used).
 * - Returns a PUBLIC URL:
 *   - Vercel Blob public (access: "public") when BLOB_READ_WRITE_TOKEN is configured.
 *   - Local static file under `public/uploads/content/` in local development.
 * - Never returns private `/api/private-file` URLs.
 */
export async function uploadContentImage(formData: FormData): Promise<UploadContentImageResult> {
    const a = await requireRole("content_editor");
    if (!a.ok) return { ok: false, error: "FORBIDDEN" };

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
        return { ok: false, error: "FILE_REQUIRED" };
    }

    try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        const checked = checkContentImage({ size: file.size, bytes });
        if (!checked.ok) {
            return { ok: false, error: checked.error };
        }

        const ext = checked.type === "jpg" ? "jpg" : "png";
        const filename = `${crypto.randomUUID()}.${ext}`;

        let url: string;

        if (process.env.BLOB_READ_WRITE_TOKEN) {
            const { put } = await import("@vercel/blob");
            const blob = await put(`content/${filename}`, Buffer.from(buffer), {
                access: "public",
                contentType: checked.type === "jpg" ? "image/jpeg" : "image/png",
            });
            url = blob.url;
        } else {
            const fs = await import("fs/promises");
            const path = await import("path");
            const uploadDir = path.join(process.cwd(), "public", "uploads", "content");
            await fs.mkdir(uploadDir, { recursive: true });
            await fs.writeFile(path.join(uploadDir, filename), Buffer.from(buffer));
            url = `/uploads/content/${filename}`;
        }

        await db.insert(auditLogs).values({
            userId: a.session.user.id,
            action: "CREATE",
            entity: "Upload",
            details: JSON.stringify({
                action: "UPLOAD_CONTENT_IMAGE",
                url,
                actorRole: a.session.user.role,
            }),
        });

        return { ok: true, url };
    } catch (err) {
        console.error("[content:uploadContentImage]", err);
        return { ok: false, error: "SERVER_ERROR" };
    }
}
