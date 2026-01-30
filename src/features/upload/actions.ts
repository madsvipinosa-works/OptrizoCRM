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
