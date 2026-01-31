"use server";

import { put } from "@vercel/blob";

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
            console.error("Local upload failed:", err);
            return { success: false, message: "Failed to save file locally." };
        }
    }

    try {
        // Upload to Vercel Blob
        const blob = await put(file.name, file, {
            access: "public",
        });

        return { success: true, url: blob.url };
    } catch (error) {
        console.error("Upload failed:", error);
        return { success: false, message: "Server error uploading file to Cloud." };
    }
}
