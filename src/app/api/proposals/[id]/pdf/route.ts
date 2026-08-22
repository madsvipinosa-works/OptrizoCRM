import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/auth";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getPuppeteerBrowser, generateSOWHtml } from "@/lib/pdf-generator";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await auth();
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

        // Access Control
        const isStaff = hasRole(session, ["superadmin", "manager", "sales", "developer", "content_editor"]);
        const isOwner = proposal.lead && session.user.id === proposal.lead.clientId;

        if (!isStaff && !isOwner) {
            return new NextResponse("Access Denied", { status: 403 });
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
            validUntil: proposal.validUntil,
        });

        const browser = await getPuppeteerBrowser();
        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: "domcontentloaded",
        });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "0mm",
                right: "0mm",
                bottom: "0mm",
                left: "0mm",
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
