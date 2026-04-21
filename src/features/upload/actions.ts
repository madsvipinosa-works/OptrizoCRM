"use server";

import { put, del } from "@vercel/blob";
import { z } from "zod";
import { auth } from "@/auth";
import { logAction } from "@/features/audit/actions";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed"
];

const fileUploadSchema = z.object({
    file: z.instanceof(File)
        .refine((file) => file.size <= MAX_FILE_SIZE, `File size must be under 20MB.`)
        .refine((file) => ALLOWED_MIME_TYPES.includes(file.type), `File type not allowed. Please upload PDF, PNG, JPG, or ZIP.`)
});

export async function deleteImage(url: string) {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "admin" && session.user.role !== "editor")) {
        return { success: false, message: "Unauthorized" };
    }

    if (!url) return;

    try {
        // New protected download URL format: /api/private-file?local=... or /api/private-file?blobUrl=...
        if (url.startsWith("/api/private-file")) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const u = new URL(url, baseUrl);

            const local = u.searchParams.get("local");
            const blobUrl = u.searchParams.get("blobUrl");

            const fs = await import("fs/promises");
            const path = await import("path");

            if (local) {
                const safeName = local.replace(/[^a-zA-Z0-9._-]/g, "");
                const filePath = path.join(process.cwd(), ".private-uploads", safeName);
                await fs.unlink(filePath);
                await logAction("DELETE", "Upload", `Deleted local private upload ${safeName}`, session.user.id);
                return { success: true };
            }

            if (blobUrl) {
                await del(blobUrl);
                await logAction("DELETE", "Upload", `Deleted private blob upload`, session.user.id);
                return { success: true };
            }

            return { success: false, message: "Missing deletion parameters" };
        }

        // Backward compatibility: old local files in public/uploads
        if (url.startsWith("/uploads/")) {
            const fs = await import("fs/promises");
            const path = await import("path");

            const filename = url.replace("/uploads/", "");
            const filePath = path.join(process.cwd(), "public", "uploads", filename);
            await fs.unlink(filePath);
            await logAction("DELETE", "Upload", `Deleted legacy public upload ${filename}`, session.user.id);
            return { success: true };
        }

        // Legacy: assume `url` is a blob URL that `del()` can handle.
        await del(url);
        await logAction("DELETE", "Upload", `Deleted legacy upload reference`, session.user.id);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete file:", error);
        return { success: false, message: "Failed to delete file" };
    }
}

export async function uploadImage(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "Unauthorized" };
    }

    const file = formData.get("file") as File;
    
    if (!file) {
        return { success: false, message: "No file uploaded." };
    }

    const validated = fileUploadSchema.safeParse({ file });
    
    if (!validated.success) {
        return { 
            success: false, 
            message: validated.error.flatten().fieldErrors.file?.[0] || "Invalid file."
        };
    }

    try {
        // Upload to a private Vercel Blob store so the content isn't publicly reachable.
        const blob = await put(file.name, file, { access: "private" });
        const downloadUrl = `/api/private-file?blobUrl=${encodeURIComponent(blob.url)}`;
        await logAction("CREATE", "Upload", `Uploaded private file ${file.name}`, session.user.id);
        return {
            success: true,
            url: downloadUrl,
        };
    } catch (error) {
        // Local/dev fallback: store into `.private-uploads` and serve via the protected route.
        try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const crypto = await import("crypto");

            const buffer = Buffer.from(await file.arrayBuffer());
            const uniqueName = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
            const uploadDir = path.join(process.cwd(), ".private-uploads");

            await fs.mkdir(uploadDir, { recursive: true });
            await fs.writeFile(path.join(uploadDir, uniqueName), buffer);

            await logAction("CREATE", "Upload", `Uploaded local private file ${uniqueName}`, session.user.id);
            return {
                success: true,
                url: `/api/private-file?local=${encodeURIComponent(uniqueName)}`,
            };
        } catch (fallbackErr) {
            const err = error as Error;
            console.error("Upload failed:", err, fallbackErr);
            return { success: false, message: `Upload failed: ${err.message || "Unknown error"}` };
        }
    }
}
