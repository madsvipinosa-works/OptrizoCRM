"use server";

import { put, del } from "@vercel/blob";

export async function deleteImage(url: string) {
    if (!url) return;

    // 1. Local File Deletion
    if (url.startsWith("/uploads/")) {
        const fs = await import("fs/promises");
        const path = await import("path");

        // Remove "/uploads/" to get the filename
        const filename = url.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "public", "uploads", filename);

        try {
            await fs.unlink(filePath);
            return { success: true };
        } catch (error) {
            console.error("Failed to delete local file:", error);
            return { success: false, message: "Failed to delete local file" };
        }
    }

    // 2. Vercel Blob Deletion
    try {
        await del(url);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete blob:", error);
        return { success: false, message: "Failed to delete blob" };
    }
}

export async function uploadImage(formData: FormData) {
    const file = formData.get("file") as File;

    if (!file) {
        return { success: false, message: "No file uploaded." };
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return { success: false, message: "File size too large (max 5MB)." };
    }

    // Local / Offline Fallback
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.warn("⚠️ Vercel Blob Token missing. Using local storage.");

        const fs = await import("fs/promises");
        const path = await import("path");
        const crypto = await import("crypto");

        const buffer = Buffer.from(await file.arrayBuffer());
        // Unique filename to prevent overwrites
        const uniqueName = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads");

        try {
            await fs.mkdir(uploadDir, { recursive: true });
            await fs.writeFile(path.join(uploadDir, uniqueName), buffer);
            return { success: true, url: `/uploads/${uniqueName}` };
        } catch (err) {
            console.error("Local upload failed (likely read-only host):", err);
            return {
                success: false,
                message: "Vercel Blob Storage is not configured. Please add BLOB_READ_WRITE_TOKEN to your Vercel Environment Variables to enable cloud uploads."
            };
        }
    }

    try {
        // Upload to Vercel Blob
        const blob = await put(file.name, file, {
            access: "public",
        });

        return { success: true, url: blob.url };
    } catch (error) {
        const err = error as Error;
        console.error("Upload failed:", err);
        return { success: false, message: `Cloud upload failed: ${err.message || "Unknown error"}` };
    }
}
