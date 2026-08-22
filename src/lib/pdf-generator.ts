import puppeteer, { Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import fs from "fs";

export async function getPuppeteerBrowser(): Promise<Browser> {
    const isWindows = process.platform === "win32";
    const isLocal = process.env.NODE_ENV === "development" || isWindows || process.platform === "darwin";

    let executablePath: string | undefined = process.env.CHROME_PATH;

    if (!executablePath && isWindows) {
        const potentialWindowsPaths = [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ];

        for (const p of potentialWindowsPaths) {
            if (fs.existsSync(p)) {
                executablePath = p;
                break;
            }
        }
    }

    if (!executablePath && !isLocal) {
        executablePath = await chromium.executablePath();
    }

    const args = isLocal && executablePath
        ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        : [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

    return await puppeteer.launch({
        args,
        defaultViewport: {
            width: 1200,
            height: 1600,
            deviceScaleFactor: 2,
        },
        executablePath: executablePath || (await chromium.executablePath()),
        headless: true,
    });
}

export function generateSOWHtml(data: {
    proposalCode: string;
    businessName: string;
    clientEmail?: string | null;
    scope?: string | null;
    technicalApproach?: string | null;
    deliverables: string[];
    timeline?: string | null;
    pricingItems: { name: string; description?: string; quantity: number; unitPrice: number; total: number }[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    terms?: string | null;
    status: string;
    acceptedByName?: string | null;
    acceptedByTitle?: string | null;
    acceptedAt?: string | Date | null;
    signatureData?: string | null;
    createdAt?: string | Date | null;
    validUntil?: string | Date | null;
    agencyName?: string;
    agencyEmail?: string;
    agencyWebsite?: string;
}): string {
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });

    const formattedCreatedDate = data.createdAt
        ? new Date(data.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const formattedValidDate = data.validUntil
        ? new Date(data.validUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "30 Days from Issue";

    const formattedSignedDate = data.acceptedAt
        ? new Date(data.acceptedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : formattedCreatedDate;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Statement of Work — ${data.proposalCode}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

        @page {
            size: A4 portrait;
            margin: 0;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #ffffff;
            color: #0f172a;
            font-size: 10pt;
            line-height: 1.5;
        }

        .page-container {
            width: 210mm;
            min-height: 297mm;
            padding: 16mm 18mm;
            margin: 0 auto;
            background: #ffffff;
            position: relative;
        }

        .header-box {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 20px;
        }

        .sub-header {
            font-size: 8pt;
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #4f46e5;
            margin-bottom: 4px;
        }

        .doc-title {
            font-family: 'Cinzel', serif;
            font-size: 20pt;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: -0.5px;
            margin-bottom: 12px;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 10px 14px;
            font-size: 8.5pt;
        }

        .meta-col strong {
            font-size: 7.5pt;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
            display: block;
            margin-bottom: 2px;
        }

        .meta-col span {
            font-weight: 600;
            color: #0f172a;
        }

        .section {
            margin-bottom: 18px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .section-title {
            font-family: 'Cinzel', serif;
            font-size: 11pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #0f172a;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 8px;
        }

        .section-content {
            font-size: 9pt;
            color: #334155;
            line-height: 1.55;
            white-space: pre-line;
        }

        .deliverables-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        .deliverable-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px 10px;
            font-size: 8.5pt;
            display: flex;
            align-items: flex-start;
            gap: 6px;
        }

        .deliverable-num {
            font-weight: 700;
            color: #4f46e5;
            font-size: 8pt;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            font-size: 8.5pt;
        }

        th {
            background: #0f172a;
            color: #ffffff;
            font-size: 7.5pt;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 7px 10px;
            text-align: left;
        }

        th.text-center { text-align: center; }
        th.text-right { text-align: right; }

        td {
            padding: 7px 10px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
        }

        td.text-center { text-align: center; }
        td.text-right { text-align: right; font-family: monospace; font-size: 9pt; }

        tfoot td {
            font-weight: 600;
            border-bottom: none;
            padding: 5px 10px;
        }

        .total-row {
            background: #f1f5f9;
            font-weight: 700;
            font-size: 10pt;
            color: #0f172a;
            border-top: 2px solid #0f172a;
        }

        .terms-box {
            background: #f8fafc;
            border-left: 3px solid #4f46e5;
            padding: 8px 12px;
            font-size: 8pt;
            color: #475569;
            line-height: 1.45;
        }

        .signature-section {
            margin-top: 20px;
            border-top: 2px solid #0f172a;
            padding-top: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-top: 10px;
        }

        .sig-block {
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 10px 12px;
            background: #fafafa;
        }

        .sig-title {
            font-size: 7.5pt;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 1px;
            color: #64748b;
            margin-bottom: 8px;
        }

        .sig-line {
            height: 36px;
            border-bottom: 1px solid #94a3b8;
            margin-bottom: 6px;
            display: flex;
            align-items: flex-end;
            font-family: 'Cinzel', serif;
            font-style: italic;
            font-size: 11pt;
            color: #0f172a;
            padding-bottom: 2px;
        }

        .sig-meta {
            font-size: 7.5pt;
            color: #64748b;
        }

        .verified-badge {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 10px 12px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .verified-text {
            color: #065f46;
            font-size: 8.5pt;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="page-container">
        <!-- Header & Parties Matrix -->
        <div class="header-box">
            <div class="sub-header">Statement of Work & Master Services Schedule</div>
            <div class="doc-title">${data.businessName} — SOW</div>

            <div class="meta-grid">
                <div class="meta-col">
                    <strong>Service Provider / Agency</strong>
                    <span>${data.agencyName || "Optrizo Digital Solutions"}</span>
                    <div style="color: #64748b; font-size: 7.5pt; margin-top: 2px;">${data.agencyEmail || "contact@optrizo.com"} • ${data.agencyWebsite || "https://optrizo.com"}</div>
                </div>
                <div class="meta-col">
                    <strong>Client / Principal</strong>
                    <span>${data.businessName}</span>
                    <div style="color: #64748b; font-size: 7.5pt; margin-top: 2px;">${data.clientEmail || "Authorized Client Representative"}</div>
                </div>
                <div class="meta-col">
                    <strong>Contract Ref & Status</strong>
                    <span>${data.proposalCode} • ${data.status.toUpperCase()}</span>
                </div>
                <div class="meta-col">
                    <strong>Effective / Valid Dates</strong>
                    <span>${formattedCreatedDate} (Valid: ${formattedValidDate})</span>
                </div>
            </div>
        </div>

        <!-- 1. Scope of Work & Project Objectives -->
        <div class="section">
            <div class="section-title">1. Project Objectives & Scope of Work</div>
            <div class="section-content">${data.scope || "Detailed scope parameters and technical deliverables."}</div>
        </div>

        <!-- 2. Technical Approach -->
        ${data.technicalApproach ? `
        <div class="section">
            <div class="section-title">2. Technical Architecture & Methodology</div>
            <div class="section-content">${data.technicalApproach}</div>
        </div>` : ""}

        <!-- 3. Deliverables Matrix -->
        ${data.deliverables.length > 0 ? `
        <div class="section">
            <div class="section-title">3. Schedule of Deliverables & Outcomes</div>
            <div class="deliverables-grid">
                ${data.deliverables.map((item, idx) => `
                    <div class="deliverable-item">
                        <span class="deliverable-num">${String(idx + 1).padStart(2, '0')}.</span>
                        <span>${item}</span>
                    </div>
                `).join("")}
            </div>
        </div>` : ""}

        <!-- 4. Timeline -->
        ${data.timeline ? `
        <div class="section">
            <div class="section-title">4. Target Timeline & Sprint Milestones</div>
            <div class="section-content">${data.timeline}</div>
        </div>` : ""}

        <!-- 5. Pricing / Investment Schedule -->
        <div class="section">
            <div class="section-title">5. Commercial Terms & Investment Schedule</div>
            <table>
                <thead>
                    <tr>
                        <th>Description & Scope Item</th>
                        <th class="text-center" style="width: 50px;">Qty</th>
                        <th class="text-right" style="width: 90px;">Rate</th>
                        <th class="text-right" style="width: 100px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.pricingItems.length > 0 ? data.pricingItems.map(item => `
                        <tr>
                            <td>
                                <strong>${item.name}</strong>
                                ${item.description ? `<div style="font-size: 7.5pt; color: #64748b;">${item.description}</div>` : ""}
                            </td>
                            <td class="text-center">${item.quantity || 1}</td>
                            <td class="text-right">${currencyFormatter.format(item.unitPrice || 0)}</td>
                            <td class="text-right"><strong>${currencyFormatter.format(item.total || (item.quantity || 1) * (item.unitPrice || 0))}</strong></td>
                        </tr>
                    `).join("") : `
                        <tr><td colspan="4" style="text-align: center; color: #64748b;">Standard project scope schedule.</td></tr>
                    `}
                </tbody>
                <tfoot>
                    ${data.discount > 0 ? `
                        <tr>
                            <td colspan="3" style="text-align: right; color: #64748b;">Special Discount Applied:</td>
                            <td class="text-right" style="color: #059669;">-${currencyFormatter.format(data.discount)}</td>
                        </tr>` : ""}
                    ${data.tax > 0 ? `
                        <tr>
                            <td colspan="3" style="text-align: right; color: #64748b;">Applicable Tax / VAT:</td>
                            <td class="text-right">+${currencyFormatter.format(data.tax)}</td>
                        </tr>` : ""}
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 1px;">Total Contract Value:</td>
                        <td class="text-right" style="color: #4f46e5; font-size: 12pt; font-weight: 800;">${currencyFormatter.format(data.total)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <!-- 6. General Terms -->
        <div class="section">
            <div class="section-title">6. General Terms & IP Ownership</div>
            <div class="terms-box">
                ${data.terms || "Standard agency terms apply: 50% deposit required upon acceptance to initiate sprint planning, with the remaining balance due upon milestone handover. All custom deliverables and intellectual property will transfer to Client upon receipt of final contract settlement."}
            </div>
        </div>

        <!-- 7. Signatures & Authorization -->
        <div class="signature-section">
            <div class="section-title" style="border: none; margin-bottom: 4px;">7. Signatures & Legal Execution</div>
            <p style="font-size: 7.5pt; color: #64748b; margin-bottom: 8px;">
                IN WITNESS WHEREOF, the parties hereto have executed this Statement of Work by their authorized representatives.
            </p>

            ${data.status === "Approved" ? `
                <div class="verified-badge">
                    <div>
                        <div class="verified-text">✓ Legally Executed Agreement (ESIGN / UETA Verified)</div>
                        <div style="font-size: 7.5pt; color: #065f46; margin-top: 2px;">
                            Executed by <strong>${data.acceptedByName || "Client Signatory"}</strong> ${data.acceptedByTitle ? `(${data.acceptedByTitle})` : ""} on ${formattedSignedDate}.
                        </div>
                    </div>
                    <div style="margin-top: 4px;">
                        ${data.signatureData && data.signatureData.startsWith("data:image/")
                            ? `<img src="${data.signatureData}" alt="Authorized Client Signature" style="max-height: 52px; max-width: 200px; object-fit: contain; filter: contrast(1.25);" />`
                            : `<span style="font-family: 'Cinzel', serif; font-style: italic; font-size: 11pt; font-weight: 700; color: #065f46;">${data.signatureData || data.acceptedByName || "Digitally Signed"}</span>`
                        }
                    </div>
                </div>
            ` : `
                <div class="signature-grid">
                    <div class="sig-block">
                        <div class="sig-title">Service Provider Authorization</div>
                        <div class="sig-line">${data.agencyName || "Optrizo"} Representative</div>
                        <div class="sig-meta">Date: ${formattedCreatedDate}</div>
                    </div>
                    <div class="sig-block">
                        <div class="sig-title">Client Acceptance & Execution</div>
                        <div class="sig-line" style="color: #94a3b8; font-family: sans-serif; font-size: 8pt;">Pending Digital Signature</div>
                        <div class="sig-meta">Date: ________________________</div>
                    </div>
                </div>
            `}
        </div>
    </div>
</body>
</html>`;
}
