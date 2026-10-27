import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getPuppeteerBrowser, generateSOWHtml, escapeHtml } from "@/lib/pdf-generator";
import { getSiteSettings } from "@/features/cms/actions";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function resolveLocalImageAsBase64(urlPath?: string | null): string | null {
    if (!urlPath) return null;
    if (urlPath.startsWith("data:")) return urlPath;
    if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) return urlPath;

    try {
        const cleanPath = urlPath.replace(/^\//, "");
        const diskPath = path.join(process.cwd(), "public", cleanPath);
        if (fs.existsSync(diskPath)) {
            const fileBuffer = fs.readFileSync(diskPath);
            const ext = path.extname(diskPath).toLowerCase().replace(".", "");
            const mimeType = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
            return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
        }
    } catch (e) {
        console.warn("Failed to convert local image to base64 for PDF:", e);
    }
    return urlPath;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log("[PDF Route] Processing request for proposal:", id);

        const session = await auth();
        console.log("[PDF Route] Session:", session?.user?.id, session?.user?.email, (session?.user as any)?.role);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const proposal = await db.query.proposals.findFirst({
            where: or(eq(proposals.id, id), eq(proposals.proposalCode, id)),
            with: {
                lead: {
                    with: {
                        client: true,
                    },
                },
            },
        });

        if (!proposal) {
            return new NextResponse("Proposal not found", { status: 404 });
        }

        // Strictly block internal production/marketing roles from financial PDFs
        const userRole = (session.user as any)?.role;
        if (["editor", "developer", "content_editor"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
        }

        // Access Control
        const isStaff = hasRole(session, ["superadmin", "manager", "sales"]);
        const isOwner =
            proposal.lead &&
            (session.user.id === proposal.lead.clientId ||
             session.user.email === proposal.lead.client?.email ||
             session.user.email === proposal.lead.contactEmail);

        // Tenant/Client Isolation Check (Prevent IDOR)
        if (userRole === "client") {
            if (!isOwner) {
                return NextResponse.json({ error: "Forbidden: You do not own this proposal" }, { status: 403 });
            }
        } else if (!isStaff) {
            return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
        }

        // Parse deliverables & pricing
        let deliverables: string[] = [];
        let pricingItems: any[] = [];

        try {
            if (proposal.deliverables) {
                deliverables = Array.isArray(proposal.deliverables)
                    ? (proposal.deliverables as string[])
                    : JSON.parse(proposal.deliverables as string);
            }
            if (proposal.pricingStructure) {
                if (Array.isArray(proposal.pricingStructure)) {
                    pricingItems = proposal.pricingStructure;
                } else if (typeof proposal.pricingStructure === "object" && proposal.pricingStructure !== null) {
                    pricingItems = (proposal.pricingStructure as any).items || [];
                } else if (typeof proposal.pricingStructure === "string") {
                    const parsed = JSON.parse(proposal.pricingStructure);
                    pricingItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
                }
            }
        } catch (e) {
            console.error("Failed to parse proposal deliverables or pricing for PDF:", e);
        }

        const proposalCode = proposal.proposalCode || `OPT-${proposal.id.split("-")[0].toUpperCase()}`;
        const businessName = proposal.lead?.businessName || proposal.lead?.client?.name || "Client";

        // Fetch agency branding from system settings (navbar/favicon)
        const siteSettings = await getSiteSettings();
        const agencyLogoUrl = resolveLocalImageAsBase64(siteSettings?.logoUrl || null);
        const agencyFaviconUrl = resolveLocalImageAsBase64(siteSettings?.faviconUrl || null);
        const agencyName = siteSettings?.heroTitle ? `${siteSettings.heroTitle} Digital Solutions` : "Optrizo Digital Solutions";
        const agencyRegistration = (proposal.contractSettings as any)?.agencyRegistration || "CS202612345";
        const agencyAddress = (proposal.contractSettings as any)?.agencyAddress || "4th Floor, Innovation Hub Building, Metro Manila, Philippines";
        const agencyPhone = (proposal.contractSettings as any)?.agencyPhone || "+63 (917) 555-1234";

        const html = generateSOWHtml({
            proposalCode,
            businessName,
            clientEmail: proposal.lead?.client?.email,
            scope: proposal.scope,
            technicalApproach: proposal.technicalApproach,
            deliverables,
            timeline: proposal.timeline,
            pricingItems,
            subtotal: proposal.subtotal || proposal.total || 0,
            discount: proposal.discount || 0,
            tax: proposal.tax || 0,
            total: proposal.total || 0,
            terms: proposal.terms,
            status: proposal.status,
            acceptedByName: proposal.acceptedByName,
            acceptedByTitle: proposal.acceptedByTitle,
            acceptedAt: proposal.acceptedAt,
            signatureData: proposal.signatureData,
            createdAt: proposal.createdAt,
            agencyName,
            agencyLogoUrl,
            agencyFaviconUrl,
            agencyRegistration,
            agencyAddress,
            agencyPhone,
            contractSettings: proposal.contractSettings as any,
        });

        const browser = await getPuppeteerBrowser();
        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: "domcontentloaded",
        });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 7.5px; color: #94a3b8; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px;">
                    <span>${escapeHtml(agencyName.toUpperCase())} &bull; Project Proposal &amp; Statement of Work</span>
                    <span style="font-family: monospace;">REF: ${escapeHtml(proposalCode)}</span>
                </div>
            `,
            footerTemplate: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 7.5px; color: #64748b; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                    <div>
                        <strong>${escapeHtml(agencyName)}</strong> &bull; SEC Reg: ${escapeHtml(agencyRegistration)} &bull; ${escapeHtml(agencyAddress)} &bull; ${escapeHtml(agencyPhone)}
                    </div>
                    <div style="font-weight: 600; font-family: monospace;">
                        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                    </div>
                </div>
            `,
            margin: {
                top: "14mm",
                right: "12mm",
                bottom: "16mm",
                left: "12mm",
            },
        });

        await browser.close();

        const filename = `Statement_of_Work_${proposalCode}_${businessName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

        const uint8 = new Uint8Array(pdfBuffer);
        return new NextResponse(uint8, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store, max-age=0",
            },
        });
    } catch (error) {
        console.error("Failed to generate server-side PDF:", error);
        return new NextResponse("Failed to generate PDF document", { status: 500 });
    }
}
