import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/auth";
import { formatDate } from "@/lib/datetime";
import { getPuppeteerBrowser } from "@/lib/pdf-generator";
import { loadReport } from "@/features/reports/load";
import { exportFilename, reportCsv, reportHtml } from "@/features/reports/export";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Super Admin downloads a report as a real file: ?format=pdf|csv&type=…&period=…&compare=… . Totals only, as on the page. */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!hasRole(session, ["superadmin"])) return new NextResponse("Forbidden", { status: 403 });

    const q = request.nextUrl.searchParams;
    const format = q.get("format");
    if (format !== "pdf" && format !== "csv") return new NextResponse("format must be pdf or csv", { status: 400 });

    const report = await loadReport(q.get("type"), q.get("period"), q.get("compare"));
    if (!report) return new NextResponse("Unknown report type or period", { status: 400 });

    const generatedBy = session?.user?.name ?? "Super Admin";
    const generatedAt = formatDate(new Date());
    const filename = exportFilename(report.title, format);
    const headers = { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store, max-age=0" };

    if (format === "csv") {
        return new NextResponse(reportCsv(report, generatedBy, generatedAt), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
    }

    let browser: Awaited<ReturnType<typeof getPuppeteerBrowser>> | null = null;
    try {
        browser = await getPuppeteerBrowser();
        const page = await browser.newPage();
        await page.setContent(reportHtml(report, generatedBy, generatedAt), { waitUntil: "domcontentloaded" });
        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: "<span></span>",
            footerTemplate: `<div style="font-family:Arial,sans-serif;font-size:8px;color:#64748b;width:100%;padding:0 12mm;display:flex;justify-content:space-between"><span>Totals only. No client names.</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
            margin: { top: "14mm", right: "12mm", bottom: "16mm", left: "12mm" },
        });
        return new NextResponse(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf" } });
    } catch (error) {
        console.error("Failed to generate the report PDF:", error);
        return new NextResponse("Failed to generate the PDF", { status: 500 });
    } finally {
        await browser?.close().catch(() => {});
    }
}
