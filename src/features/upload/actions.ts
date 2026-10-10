"use server";

import { put, del } from "@vercel/blob";
import { auth, hasRole } from "@/auth";
import { logAction } from "@/features/audit/actions";
import { logSystemError } from "@/features/audit/error-logger";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/gif",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/x-zip-compressed"
] as const;

export async function deleteImage(url: string) {
    const session = await auth();
    if (!hasRole(session, ["superadmin", "manager", "content_editor", "sales"])) {
        return { success: false, message: "Unauthorized" };
    }

    if (!url) return { success: false, message: "No URL provided" };

    try {
        if (url.startsWith("/api/private-file")) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const u = new URL(url, baseUrl);
            const blobUrl = u.searchParams.get("blobUrl");

            if (blobUrl) {
                if (blobUrl.startsWith("/uploads/")) {
                    return deleteImage(blobUrl);
                }
                
                if (process.env.BLOB_READ_WRITE_TOKEN) {
                    await del(blobUrl);
                    await logAction("DELETE", "Upload", `Deleted private blob upload`, session.user.id);
                    return { success: true };
                }
            }

            return { success: false, message: "Missing deletion parameters or token" };
        }

        // Local storage cleanup: /uploads/<filename>
        if (url.startsWith("/uploads/")) {
            const fs = await import("fs/promises");
            const path = await import("path");

            const filename = path.basename(url);
            const filePath = path.join(process.cwd(), "public", "uploads", filename);
            try {
                await fs.unlink(filePath);
                await logAction("DELETE", "Upload", `Deleted local upload ${filename}`, session.user.id);
            } catch (err) {
                console.warn(`Local file ${filename} not found or already deleted:`, err);
            }
            return { success: true };
        }

        // Remote Vercel Blob deletion
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            await del(url);
            await logAction("DELETE", "Upload", `Deleted upload reference`, session.user.id);
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to delete file:", error);
        return { success: false, message: "Failed to delete file" };
    }
}

export async function uploadSecureAsset(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized access.", message: "Unauthorized access." };
    }

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
        return { success: false, error: "No valid file payload provided.", message: "No valid file payload provided." };
    }

    // 1. Enforce File Size Boundary
    if (file.size > MAX_FILE_SIZE) {
        const errorMsg = `File exceeds maximum allowed size of 15MB (Received ${(file.size / (1024 * 1024)).toFixed(1)}MB).`;
        return { success: false, error: errorMsg, message: errorMsg };
    }

    // 2. Enforce Strict MIME Validation
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
        const errorMsg = `Disallowed file type: ${file.type || "unknown"}. Allowed: Images (JPG, PNG, WEBP, SVG, GIF, ICO), PDF, DOC, DOCX, ZIP.`;
        return { success: false, error: errorMsg, message: errorMsg };
    }

    // 2b. Magic Byte Inspection
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer).subarray(0, 8);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    let isMagicValid = false;
    // PDF: 25 50 44 46
    if (hex.startsWith("25504446")) isMagicValid = true;
    // PNG: 89 50 4E 47
    else if (hex.startsWith("89504E47")) isMagicValid = true;
    // JPEG: FF D8 FF
    else if (hex.startsWith("FFD8FF")) isMagicValid = true;
    // WEBP: 52 49 46 46 (RIFF) + 4 bytes + 57 45 42 50 (WEBP)
    else if (hex.startsWith("52494646") && hex.substring(16, 24) === "57454250") isMagicValid = true;
    // GIF: 47 49 46 38
    else if (hex.startsWith("47494638")) isMagicValid = true;
    // ZIP / DOCX: 50 4B 03 04
    else if (hex.startsWith("504B0304")) isMagicValid = true;
    // ICO / SVG are harder to strictly magic-byte without complex parsing, allow if we strictly want them or reject.
    else if (file.type === "image/svg+xml" && hex.includes("3C")) isMagicValid = true; // '<' basic check
    else if (file.type.includes("icon")) isMagicValid = true; // Skip strict for icons

    if (!isMagicValid) {
        return { success: false, error: "File contents do not match allowed types.", message: "File contents do not match allowed types." };
    }

    // 3. Sanitize File Name
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Local / Offline Fallback when BLOB_READ_WRITE_TOKEN is missing (e.g. in local development)
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const fs = await import("fs");
            const fsp = await import("fs/promises");
            const path = await import("path");
            const crypto = await import("crypto");
            const { pipeline } = await import("stream/promises");
            const { Readable } = await import("stream");

            const uniqueName = `${crypto.randomUUID()}-${sanitizedFilename}`;
            const uploadDir = path.join(process.cwd(), "public", "uploads");

            await fsp.mkdir(uploadDir, { recursive: true });
            
            await pipeline(
                Readable.fromWeb(file.stream() as any),
                fs.createWriteStream(path.join(uploadDir, uniqueName))
            );

            await logAction("CREATE", "Upload", `Uploaded local file ${uniqueName}`, session.user.id);

            const projectId = formData.get("projectId") as string | null;
            let fileUrl = `/uploads/${uniqueName}`;
            if (projectId) {
                fileUrl = `/api/private-file?blobUrl=${encodeURIComponent(fileUrl)}&projectId=${projectId}`;
            }

            return {
                success: true,
                url: fileUrl,
                downloadUrl: fileUrl,
                size: file.size,
                mimeType: file.type,
                message: "Upload successful",
            };
        } catch (localErr) {
            console.error("[LOCAL_UPLOAD_ERROR]:", localErr);
            return {
                success: false,
                error: "Failed to write local file.",
                message: "Failed to save file locally.",
            };
        }
    }

    // Production Vercel Blob Upload
    const uniqueBlobPath = `tenants/${session.user.id}/${Date.now()}-${sanitizedFilename}`;

    try {
        const blob = await put(uniqueBlobPath, file, {
            access: "public",
            addRandomSuffix: true,
        });

        await logAction("CREATE", "Upload", `Uploaded secure asset ${file.name}`, session.user.id);
        
        const projectId = formData.get("projectId") as string | null;
        let finalUrl = blob.url;
        if (projectId) {
            finalUrl = `/api/private-file?blobUrl=${encodeURIComponent(blob.url)}&projectId=${projectId}`;
        }

        return {
            success: true,
            url: finalUrl,
            downloadUrl: finalUrl,
            size: file.size,
            mimeType: file.type,
            message: "Upload successful",
        };
    } catch (error) {
        console.error("[SECURE_UPLOAD_ERROR]:", error);
        await logSystemError(error, {
            errorCode: "UPLOAD_BLOB_FAILURE",
            severity: "HIGH",
            source: "action:upload:uploadSecureAsset",
            context: { fileName: file?.name, fileSize: file?.size, fileType: file?.type },
            userId: session?.user?.id,
        });
        return { success: false, error: "Failed to upload asset to storage provider.", message: "Failed to upload asset." };
    }
}

export const uploadImage = uploadSecureAsset;

