"use server";

import { put, del } from "@vercel/blob";
import { z } from "zod";
import { auth, hasRole } from "@/auth";
import { logAction } from "@/features/audit/actions";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed"
] as const;

export async function deleteImage(url: string) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "content_editor", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!url) return;

    try {
        if (url.startsWith("/api/private-file")) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const u = new URL(url, baseUrl);
            const blobUrl = u.searchParams.get("blobUrl");

            if (blobUrl) {
                await del(blobUrl);
                await logAction("DELETE", "Upload", `Deleted private blob upload`, session.user.id);
                return { success: true };
            }

            return { success: false, message: "Missing deletion parameters" };
        }

        await del(url);
        await logAction("DELETE", "Upload", `Deleted upload reference`, session.user.id);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete file:", error);
        return { success: false, message: "Failed to delete file" };
    }
}

export async function uploadSecureAsset(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized access." };
    }

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
        return { success: false, error: "No valid file payload provided." };
    }

    // 1. Enforce File Size Boundary
    if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: `File exceeds maximum allowed size of 15MB (Received ${(file.size / (1024 * 1024)).toFixed(1)}MB).` };
    }

    // 2. Enforce Strict MIME Validation
    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
        return { success: false, error: `Disallowed file type: ${file.type}. Allowed: JPG, PNG, WEBP, SVG, PDF, ZIP.` };
    }

    // 3. Sanitize File Name
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueBlobPath = `tenants/${session.user.id}/${Date.now()}-${sanitizedFilename}`;

    try {
        const blob = await put(uniqueBlobPath, file, {
            access: "public",
            addRandomSuffix: true,
        });

        await logAction("CREATE", "Upload", `Uploaded secure asset ${file.name}`, session.user.id);
        
        return {
            success: true,
            url: blob.url,
            downloadUrl: blob.downloadUrl,
            size: file.size,
            mimeType: file.type,
            message: "Upload successful",
        };
    } catch (error) {
        console.error("[SECURE_UPLOAD_ERROR]:", error);
        return { success: false, error: "Failed to upload asset to storage provider.", message: "Failed to upload asset." };
    }
}

export const uploadImage = uploadSecureAsset;

