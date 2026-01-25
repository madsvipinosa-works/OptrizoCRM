"use server";

import fs from "node:fs/promises";
import path from "node:path";

export async function uploadImage(formData: FormData) {
    const file = formData.get("file") as File;

    if (!file) {
        return { success: false, message: "No file uploaded." };
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return { success: false, message: "File size too large (max 5MB)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = file.name.replace(/\s+/g, "-").toLowerCase();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix}-${originalName}`;

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    try {
        await fs.mkdir(uploadsDir, { recursive: true });
    } catch {
        // Ignore if exists
    }

    const filePath = path.join(uploadsDir, filename);

    try {
        await fs.writeFile(filePath, buffer);
        const url = `/uploads/${filename}`;
        return { success: true, url };
    } catch (error) {
        console.error("Upload failed:", error);
        return { success: false, message: "Server error uploading file." };
    }
}
