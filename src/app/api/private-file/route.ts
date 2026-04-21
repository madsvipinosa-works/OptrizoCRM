import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";

// Authenticated file proxy for private Vercel Blob + local dev private uploads.
// This prevents confidential artifacts from being accessible directly via stored URLs.
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blobUrl = request.nextUrl.searchParams.get("blobUrl");
    const local = request.nextUrl.searchParams.get("local");

    if (!blobUrl && !local) {
        return NextResponse.json({ error: "Missing file parameters" }, { status: 400 });
    }

    // Serve local private uploads (development fallback)
    if (local) {
        // Basic filename hardening to reduce traversal risk.
        const safeName = local.replace(/[^a-zA-Z0-9._-]/g, "");
        const filePath = path.join(process.cwd(), ".private-uploads", safeName);

        try {
            const buffer = await fs.readFile(filePath);
            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": "application/octet-stream",
                    "X-Content-Type-Options": "nosniff",
                    "Cache-Control": "no-store",
                },
            });
        } catch {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
    }

    // Serve private Vercel Blob content via authenticated fetch.
    if (blobUrl) {
        try {
            const token = process.env.BLOB_READ_WRITE_TOKEN;
            if (!token) {
                return NextResponse.json({ error: "Blob token not configured" }, { status: 500 });
            }

            const response = await fetch(blobUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            });

            if (!response.ok || !response.body) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }

            const contentType = response.headers.get("content-type") || "application/octet-stream";

            return new NextResponse(response.body, {
                headers: {
                    "Content-Type": contentType,
                    "X-Content-Type-Options": "nosniff",
                    "Cache-Control": "no-store",
                },
            });
        } catch {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
}

