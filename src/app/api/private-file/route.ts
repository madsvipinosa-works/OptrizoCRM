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
    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!blobUrl && !local) {
        return NextResponse.json({ error: "Missing file parameters" }, { status: 400 });
    }

    if (projectId) {
        const { hasRole } = await import("@/auth");
        const isAgency = hasRole(session, ["superadmin", "manager", "content_editor", "sales"]);
        
        if (!isAgency) {
            const { db } = await import("@/db");
            const { projectStakeholders } = await import("@/db/schema");
            const { and, eq } = await import("drizzle-orm");
            
            const stakeholder = await db.query.projectStakeholders.findFirst({
                where: and(
                    eq(projectStakeholders.projectId, projectId),
                    eq(projectStakeholders.userId, session.user.id)
                )
            });
            if (!stakeholder) {
                return NextResponse.json({ error: "Forbidden: Not a project stakeholder" }, { status: 403 });
            }
        }
    }

    // Serve local private uploads (development fallback)
    if (local || (blobUrl && blobUrl.startsWith("/uploads/"))) {
        const safeName = (local || blobUrl || "").replace(/^.*[\\/]/, '').replace(/[^a-zA-Z0-9._-]/g, "");
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

