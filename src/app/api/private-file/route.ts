import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { authorizeProject, fileBelongsToProject, requireSession } from "@/lib/authz";

// Authenticated file proxy for private Vercel Blob + local dev private uploads.
// Every request must name a project the caller can read, and the file must belong to that project.

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

function isVercelBlobUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname.endsWith(BLOB_HOST_SUFFIX);
    } catch {
        return false;
    }
}

export async function GET(request: NextRequest) {
    const signedIn = await requireSession();
    if (!signedIn.ok) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blobUrl = request.nextUrl.searchParams.get("blobUrl");
    const local = request.nextUrl.searchParams.get("local");
    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!blobUrl && !local) {
        return NextResponse.json({ error: "Missing file parameters" }, { status: 400 });
    }

    // No project, no access check: a file is only ever served in the context of a project.
    if (!projectId) {
        return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const access = await authorizeProject(projectId, "read");
    if (!access.ok) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isLocal = Boolean(local) || Boolean(blobUrl && blobUrl.startsWith("/uploads/"));
    const safeName = isLocal ? (local || blobUrl || "").replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._-]/g, "") : "";
    const fileRef = isLocal ? `/uploads/${safeName}` : (blobUrl as string);

    // Access to this project must not unlock files that belong to a different one.
    if (!(await fileBelongsToProject(projectId, fileRef))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Serve local private uploads (development fallback)
    if (isLocal) {
        const filePath = path.join(process.cwd(), "public", "uploads", safeName);

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
    // The storage token is only ever sent to Vercel Blob, never to a host the caller chose.
    if (!isVercelBlobUrl(fileRef)) {
        return NextResponse.json({ error: "Unsupported file location" }, { status: 400 });
    }

    try {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        if (!token) {
            return NextResponse.json({ error: "Blob token not configured" }, { status: 500 });
        }

        const response = await fetch(fileRef, {
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
