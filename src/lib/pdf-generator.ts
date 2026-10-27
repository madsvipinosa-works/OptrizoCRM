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

export function escapeHtml(unsafe: string = ""): string {
    return String(unsafe ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
    agencyRegistration?: string;
    agencyAddress?: string;
    agencyPhone?: string;
    agencyLogoUrl?: string | null;
    agencyFaviconUrl?: string | null;
    contractSettings?: any;
}): string {
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });

    const cs = data.contractSettings || {};
    const safeProposalCode = escapeHtml(data.proposalCode);
    const safeBusinessName = escapeHtml(data.businessName);
    const safeClientEmail = data.clientEmail ? escapeHtml(data.clientEmail) : null;
    const safeScope = escapeHtml(data.scope || "Detailed scope parameters and technical deliverables.");
    const safeTechnicalApproach = data.technicalApproach ? escapeHtml(data.technicalApproach) : null;
    const safeTimeline = data.timeline ? escapeHtml(data.timeline) : null;
    const safeTerms = escapeHtml(data.terms || "Standard agency terms apply: 50% deposit required upon acceptance to initiate sprint planning, with the remaining balance due upon milestone handover. All custom deliverables and intellectual property will transfer to Client upon receipt of final contract settlement.");
    const safeAcceptedByName = data.acceptedByName ? escapeHtml(data.acceptedByName) : "Client Signatory";
    const safeAcceptedByTitle = data.acceptedByTitle ? escapeHtml(data.acceptedByTitle) : null;
    const safeAgencyName = escapeHtml(data.agencyName || "Optrizo Digital Solutions");
    const safeAgencyEmail = escapeHtml(data.agencyEmail || "contact@optrizo.com");
    const safeAgencyWebsite = escapeHtml(data.agencyWebsite || "https://optrizo.com");
    const safeAgencyReg = escapeHtml(cs.agencyRegistration || data.agencyRegistration || "CS202612345");
    const safeAgencyAddress = escapeHtml(cs.agencyAddress || data.agencyAddress || "4th Floor, Innovation Hub Building, Metro Manila, Philippines");
    const safeAgencyPhone = escapeHtml(cs.agencyPhone || data.agencyPhone || "+63 (917) 555-1234");
    const safeAgencyLogoUrl = data.agencyLogoUrl && (
        data.agencyLogoUrl.startsWith("data:image/") ||
        data.agencyLogoUrl.startsWith("http://") ||
        data.agencyLogoUrl.startsWith("https://") ||
        data.agencyLogoUrl.startsWith("/")
    ) ? escapeHtml(data.agencyLogoUrl) : null;
    const safeAgencyFaviconUrl = data.agencyFaviconUrl && (
        data.agencyFaviconUrl.startsWith("data:image/") ||
        data.agencyFaviconUrl.startsWith("http://") ||
        data.agencyFaviconUrl.startsWith("https://") ||
        data.agencyFaviconUrl.startsWith("/")
    ) ? escapeHtml(data.agencyFaviconUrl) : null;

    const formattedCreatedDate = data.createdAt
        ? new Date(data.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    const formattedValidDate = data.validUntil
        ? new Date(data.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "30 Days from Issue";

    const formattedSignedDate = data.acceptedAt
        ? new Date(data.acceptedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : formattedCreatedDate;

    // Check if signature is a valid base64 data URL
    const isValidSignatureImage = Boolean(
        data.signatureData &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.signatureData)
    );

    let sectionNum = 0;
    const nextNum = () => { sectionNum++; return sectionNum; };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Statement of Work — ${safeProposalCode}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 12mm 14mm 12mm;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            font-size: 9.5pt;
            line-height: 1.5;
        }

        .sheet-container {
            width: 100%;
            margin: 0 auto;
            background: #ffffff;
        }

        .header-box {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 18px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 12px;
            margin-bottom: 12px;
        }

        .brand-block {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .brand-text {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.3px;
        }

        .brand-accent {
            color: #00D639;
        }

        .brand-sub {
            font-size: 6.5pt;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            color: #64748b;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            margin-top: 1px;
        }

        .ref-box {
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 7.5pt;
            color: #64748b;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 6px 12px;
            border-radius: 6px;
        }

        .ref-badge {
            font-weight: 700;
            color: #00D639;
            font-size: 6.5pt;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .sub-header {
            font-size: 7.5pt;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: #00D639;
            margin-bottom: 4px;
        }

        .doc-title {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 19pt;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
        }

        .prepared-for {
            font-size: 8.5pt;
            color: #64748b;
            margin-bottom: 12px;
        }

        .parties-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 14px;
            font-size: 8pt;
            margin-bottom: 10px;
            width: 100%;
            box-sizing: border-box;
            overflow: hidden;
        }

        .party-col {
            min-width: 0;
            overflow: hidden;
            word-break: break-word;
        }

        .party-col strong {
            font-size: 7pt;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #64748b;
            display: block;
            margin-bottom: 3px;
        }

        .party-name {
            font-weight: 700;
            font-size: 9pt;
            color: #0f172a;
            margin-bottom: 2px;
            word-break: break-word;
        }

        .party-meta {
            color: #64748b;
            font-size: 7.5pt;
            line-height: 1.4;
            word-break: break-all;
            overflow-wrap: anywhere;
        }

        .dates-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 7.5pt;
            color: #64748b;
            padding-top: 4px;
        }

        .dates-bar span {
            color: #0f172a;
            font-weight: 600;
        }

        .section {
            margin-bottom: 16px;
            page-break-inside: avoid;
            break-inside: avoid;
            width: 100%;
        }

        .section-title {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 10.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 8px;
        }

        .section-content {
            font-size: 9pt;
            color: #334155;
            line-height: 1.55;
            white-space: pre-line;
            word-break: break-word;
        }

        .deliverables-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        .deliverable-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
            font-size: 8.5pt;
            display: flex;
            align-items: flex-start;
            gap: 8px;
            word-break: break-word;
            overflow: hidden;
        }

        .deliverable-num {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
            color: #00D639;
            font-size: 8pt;
            flex-shrink: 0;
            margin-top: 1px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 6px;
            font-size: 8.5pt;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
        }

        th {
            background: #f8fafc;
            color: #64748b;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 7pt;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }

        th.text-center { text-align: center; }
        th.text-right { text-align: right; }

        td {
            padding: 8px 10px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            word-break: break-word;
        }

        td.text-center { text-align: center; font-family: ui-monospace, SFMono-Regular, monospace; }
        td.text-right { text-align: right; font-family: ui-monospace, SFMono-Regular, monospace; white-space: nowrap; }

        .line-item-desc {
            font-size: 7.5pt;
            color: #64748b;
            margin-top: 2px;
            line-height: 1.35;
        }

        tfoot td {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            padding: 6px 10px;
            font-size: 8pt;
        }

        .total-row {
            background: rgba(0, 214, 57, 0.06);
            font-weight: 700;
            font-size: 9.5pt;
            color: #0f172a;
            border-top: 2px solid #e2e8f0;
        }

        .total-amount {
            color: #00D639;
            font-size: 11pt;
            font-weight: 800;
        }

        .clause-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 8px;
            font-size: 8pt;
            color: #475569;
            line-height: 1.45;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .clause-title {
            font-weight: 700;
            font-size: 7.5pt;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #0f172a;
            margin-bottom: 3px;
        }

        .signature-section {
            margin-top: 18px;
            border-top: 2px solid #e2e8f0;
            padding-top: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
            width: 100%;
        }

        .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-top: 10px;
        }

        .sig-block {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 12px;
            background: #fafafa;
        }

        .sig-title {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 7.5pt;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.8px;
            color: #64748b;
            margin-bottom: 8px;
        }

        .sig-line {
            height: 36px;
            border-bottom: 1px solid #cbd5e1;
            margin-bottom: 6px;
            display: flex;
            align-items: flex-end;
            font-family: Georgia, 'Times New Roman', serif;
            font-style: italic;
            font-size: 10pt;
            color: #0f172a;
            padding-bottom: 2px;
        }

        .sig-meta {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 7.5pt;
            color: #64748b;
        }

        .verified-badge {
            background: rgba(0, 214, 57, 0.08);
            border: 1px solid rgba(0, 214, 57, 0.3);
            padding: 10px 14px;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .verified-text {
            color: #16a34a;
            font-size: 8.5pt;
            font-weight: 700;
        }

        .doc-footer {
            margin-top: 24px;
            border-top: 2px solid #e2e8f0;
            padding-top: 10px;
            font-size: 7.5pt;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
            page-break-inside: avoid;
            break-inside: avoid;
        }
    </style>
</head>
<body>
    <div class="sheet-container">
        <!-- Letterhead Header -->
        <div class="header-box">
            <div class="header-top">
                <div class="brand-block">
                    ${safeAgencyLogoUrl ? `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${safeAgencyLogoUrl}" alt="${safeAgencyName}" style="max-height: 40px; max-width: 170px; object-fit: contain;" />
                            <div style="border-left: 1px solid #cbd5e1; padding-left: 10px;">
                                <div class="brand-text" style="font-size: 10pt; text-transform: uppercase;">${safeAgencyName}</div>
                                <div class="brand-sub">Enterprise Systems &bull; Strategic IT</div>
                            </div>
                        </div>
                    ` : safeAgencyFaviconUrl ? `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; background: #0f172a; border: 1px solid rgba(0, 214, 57, 0.4); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 4px;">
                                <img src="${safeAgencyFaviconUrl}" alt="Favicon" style="width: 26px; height: 26px; object-fit: contain;" />
                            </div>
                            <div>
                                <div class="brand-text">OPTRIZO <span class="brand-accent">DIGITAL SOLUTIONS</span></div>
                                <div class="brand-sub">Enterprise Systems &bull; Digital Engineering &bull; Strategic IT</div>
                            </div>
                        </div>
                    ` : `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; background: #0f172a; border: 1px solid rgba(0, 214, 57, 0.4); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <svg width="20" height="22" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 1L22 6.77V19.23L12 25L2 19.23V6.77L12 1Z" stroke="#00D639" stroke-width="2.2" stroke-linejoin="round"/>
                                    <path d="M7 16V12M12 18V8M17 16V10" stroke="#00D639" stroke-width="2.2" stroke-linecap="round"/>
                                </svg>
                            </div>
                            <div>
                                <div class="brand-text">OPTRIZO <span class="brand-accent">DIGITAL SOLUTIONS</span></div>
                                <div class="brand-sub">Enterprise Systems &bull; Digital Engineering &bull; Strategic IT</div>
                            </div>
                        </div>
                    `}
                </div>
                <div class="ref-box">
                    <div class="ref-badge">Official Digital Document</div>
                    <div>REF: <strong style="color: #0f172a;">${safeProposalCode}</strong></div>
                    <div>STATUS: <strong style="color: #0f172a;">${escapeHtml(data.status).toUpperCase()}</strong></div>
                </div>
            </div>

            <div class="sub-header">Commercial Engagement Agreement</div>
            <div class="doc-title">Project Proposal &amp; Statement of Work</div>
            ${data.businessName ? `<div class="prepared-for">Prepared exclusively for: <strong style="color: #0f172a;">${safeBusinessName}</strong></div>` : ""}

            <div class="parties-grid">
                <div class="party-col">
                    <strong>Service Provider / Contractor</strong>
                    <div class="party-name">${safeAgencyName}</div>
                    <div class="party-meta">${safeAgencyEmail} &bull; ${safeAgencyWebsite}</div>
                    <div class="party-meta">Phone: ${safeAgencyPhone}</div>
                    <div class="party-meta">${safeAgencyAddress}</div>
                    <div class="party-meta" style="font-family: monospace; font-size: 7pt; margin-top: 2px;">Company Reg. / SEC No: <strong>${safeAgencyReg}</strong></div>
                </div>
                <div class="party-col" style="border-left: 1px solid #e2e8f0; padding-left: 12px;">
                    <strong>Client / Principal</strong>
                    <div class="party-name">${safeBusinessName}</div>
                    ${cs.clientContactPerson ? `<div class="party-meta">Attn: ${escapeHtml(cs.clientContactPerson)}</div>` : ""}
                    <div class="party-meta">${safeClientEmail || "Authorized Representative"}</div>
                    ${cs.clientPhone ? `<div class="party-meta">Phone: ${escapeHtml(cs.clientPhone)}</div>` : ""}
                    <div class="party-meta">${cs.clientAddress ? escapeHtml(cs.clientAddress) : "Address: To be furnished upon registration"}</div>
                </div>
            </div>

            <div class="dates-bar">
                <div>EFFECTIVE DATE: <span>${formattedCreatedDate}</span></div>
                <div>EXPIRATION DATE: <span>${formattedValidDate}</span></div>
            </div>
        </div>

        <!-- 1. Scope of Work -->
        <div class="section">
            <div class="section-title">${nextNum()}. Project Objectives &amp; Scope of Work</div>
            <div class="section-content">${safeScope}</div>
        </div>

        <!-- 2. Technical Architecture -->
        ${safeTechnicalApproach ? `
        <div class="section">
            <div class="section-title">${nextNum()}. Technical Architecture &amp; Methodology</div>
            <div class="section-content">${safeTechnicalApproach}</div>
        </div>` : ""}

        <!-- 3. Deliverables -->
        ${data.deliverables.length > 0 ? `
        <div class="section">
            <div class="section-title">${nextNum()}. Schedule of Deliverables &amp; Outcomes</div>
            <div class="deliverables-grid">
                ${data.deliverables.map((item, idx) => `
                    <div class="deliverable-item">
                        <span class="deliverable-num">${String(idx + 1).padStart(2, '0')}.</span>
                        <span>${escapeHtml(item)}</span>
                    </div>
                `).join("")}
            </div>
        </div>` : ""}

        <!-- 4. Timeline -->
        ${safeTimeline ? `
        <div class="section">
            <div class="section-title">${nextNum()}. Target Timeline &amp; Delivery Schedule</div>
            <div class="section-content">${safeTimeline}</div>
        </div>` : ""}

        <!-- 5. Investment Schedule / Commercial Terms -->
        <div class="section">
            <div class="section-title">${nextNum()}. Commercial Terms &amp; Investment Schedule</div>
            <table>
                <colgroup>
                    <col style="width: 52%;" />
                    <col style="width: 12%;" />
                    <col style="width: 18%;" />
                    <col style="width: 18%;" />
                </colgroup>
                <thead>
                    <tr>
                        <th>Description &amp; Scope Breakdown</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Rate</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.pricingItems.length > 0 ? data.pricingItems.map(item => `
                        <tr>
                            <td>
                                <strong>${escapeHtml(item.name)}</strong>
                                ${item.description ? `<div class="line-item-desc">${escapeHtml(item.description)}</div>` : ""}
                            </td>
                            <td class="text-center">${Number(item.quantity) || 1}</td>
                            <td class="text-right">${currencyFormatter.format(Number(item.unitPrice) || 0)}</td>
                            <td class="text-right"><strong>${currencyFormatter.format(Number(item.total) || (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0))}</strong></td>
                        </tr>
                    `).join("") : `
                        <tr><td colspan="4" style="text-align: center; color: #64748b;">No line items configured.</td></tr>
                    `}
                </tbody>
                <tfoot>
                    ${data.discount > 0 ? `
                        <tr>
                            <td colspan="3" style="text-align: right; color: #64748b;">Special Discount Applied:</td>
                            <td class="text-right" style="color: #16a34a; font-weight: 600;">-${currencyFormatter.format(data.discount)}</td>
                        </tr>` : ""}
                    ${data.tax > 0 ? `
                        <tr>
                            <td colspan="3" style="text-align: right; color: #64748b;">Applicable Tax / VAT:</td>
                            <td class="text-right" style="font-weight: 600;">+${currencyFormatter.format(data.tax)}</td>
                        </tr>` : ""}
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.8px;">Total Contract Value:</td>
                        <td class="text-right total-amount">${currencyFormatter.format(data.total)}</td>
                    </tr>
                </tfoot>
            </table>
            ${cs.paymentMethod ? `
                <div style="font-size: 7.5pt; color: #64748b; margin-top: 6px; padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                    <strong>Accepted Payment Method:</strong> ${escapeHtml(cs.paymentMethod)}
                </div>
            ` : ""}
        </div>

        <!-- 6. General Terms -->
        <div class="section">
            <div class="section-title">${nextNum()}. General Terms, Intellectual Property &amp; Payment Milestones</div>
            <div class="clause-card" style="border-left: 3px solid #00D639;">
                ${safeTerms}
            </div>
        </div>

        <!-- Additional Legal Provisions -->
        ${(cs.includeConfidentiality || cs.includeIpClause || cs.includeLiabilityClause || cs.includeForceClause || cs.includeChangeOrder || cs.includeDisputeResolution || cs.governingLaw || cs.customClauses) ? `
        <div class="section">
            <div class="section-title">${nextNum()}. Additional Legal Provisions</div>
            ${cs.includeConfidentiality ? `
                <div class="clause-card">
                    <div class="clause-title">Confidentiality &amp; Non-Disclosure</div>
                    <div>Both parties agree to hold all non-public information exchanged under this Agreement in strict confidence and not to disclose such information to any third party without prior written consent. This obligation survives termination for two (2) years.</div>
                </div>
            ` : ""}
            ${cs.includeIpClause ? `
                <div class="clause-card">
                    <div class="clause-title">Intellectual Property &amp; Work-for-Hire</div>
                    <div>Upon receipt of full and final payment, all custom deliverables, source code, designs, and documentation created specifically for the Client under this Agreement shall become the sole intellectual property of the Client.</div>
                </div>
            ` : ""}
            ${cs.includeLiabilityClause ? `
                <div class="clause-card">
                    <div class="clause-title">Limitation of Liability</div>
                    <div>The total aggregate liability of the Service Provider under or in connection with this Agreement shall not exceed the total fees paid by the Client in the three (3) months preceding the claim. Neither party shall be liable for indirect or consequential damages.</div>
                </div>
            ` : ""}
            ${cs.includeForceClause ? `
                <div class="clause-card">
                    <div class="clause-title">Force Majeure</div>
                    <div>Neither party shall be liable for delays or failures in performance resulting from causes beyond their reasonable control, including natural disasters, governmental actions, or infrastructure outages.</div>
                </div>
            ` : ""}
            ${cs.includeChangeOrder ? `
                <div class="clause-card">
                    <div class="clause-title">Change Order &amp; Scope Amendment Process</div>
                    <div>Any additions or material changes to the agreed scope of work must be documented in a written Change Order, mutually signed by both parties, prior to commencement of additional work.</div>
                </div>
            ` : ""}
            ${cs.includeDisputeResolution ? `
                <div class="clause-card">
                    <div class="clause-title">Dispute Resolution</div>
                    <div>The parties agree to resolve any dispute through good-faith negotiation. If unresolved within thirty (30) days, the dispute shall be submitted to binding arbitration in accordance with applicable commercial arbitration rules.</div>
                </div>
            ` : ""}
            ${cs.governingLaw ? `
                <div class="clause-card">
                    <div class="clause-title">Governing Law &amp; Jurisdiction</div>
                    <div>This Agreement shall be governed by and construed in accordance with the laws of <strong>${escapeHtml(cs.governingLaw)}</strong>.</div>
                </div>
            ` : ""}
            ${cs.customClauses ? `
                <div class="clause-card">
                    <div class="clause-title">Additional Agreed Terms</div>
                    <div style="white-space: pre-line;">${escapeHtml(cs.customClauses)}</div>
                </div>
            ` : ""}
        </div>
        ` : ""}

        <!-- Signatures & Authorization -->
        <div class="signature-section">
            <div class="section-title" style="border: none; margin-bottom: 4px;">${nextNum()}. Signatures &amp; Authorization</div>
            <p style="font-size: 7.5pt; color: #64748b; margin-bottom: 8px;">
                IN WITNESS WHEREOF, the parties hereto have caused this Statement of Work to be executed by their duly authorized representatives.
            </p>

            ${data.status === "Approved" ? `
                <div class="verified-badge">
                    <div>
                        <div class="verified-text">&#10003; Digital Portal Sign-Off &amp; Verification Timestamp</div>
                        <div style="font-size: 7.5pt; color: #16a34a; margin-top: 2px;">
                            Approved via Client Portal by <strong>${safeAcceptedByName}</strong> ${safeAcceptedByTitle ? `(${safeAcceptedByTitle})` : ""} on ${formattedSignedDate}.
                        </div>
                    </div>
                    <div style="margin-top: 2px;">
                        ${isValidSignatureImage
                            ? `<img src="${data.signatureData}" alt="Authorized Client Signature" style="max-height: 48px; max-width: 190px; object-fit: contain; filter: contrast(1.25);" />`
                            : `<span style="font-family: Georgia, serif; font-style: italic; font-size: 11pt; font-weight: 700; color: #16a34a;">${escapeHtml(data.signatureData || safeAcceptedByName)}</span>`
                        }
                    </div>
                </div>
            ` : `
                <div class="signature-grid">
                    <div class="sig-block">
                        <div class="sig-title">Service Provider Authorization</div>
                        <div class="sig-line">${safeAgencyName} Representative</div>
                        <div class="sig-meta">Date: ${formattedCreatedDate}</div>
                    </div>
                    <div class="sig-block">
                        <div class="sig-title">Client Acceptance &amp; Execution</div>
                        <div class="sig-line" style="color: #94a3b8; font-family: sans-serif; font-size: 8pt;">Pending Digital Signature</div>
                        <div class="sig-meta">Date: ________________________</div>
                    </div>
                </div>
            `}
        </div>

        <!-- Reusable Legal Footprint Footer -->
        <div class="doc-footer">
            <div>
                <strong style="color: #0f172a;">Optrizo Digital Solutions</strong> &bull; SEC Reg: ${safeAgencyReg} &bull; ${safeAgencyAddress} &bull; ${safeAgencyPhone}
                <div style="font-size: 6.5pt; color: #94a3b8; margin-top: 2px;">&copy; ${new Date().getFullYear()} Optrizo Digital Solutions. All rights reserved. Generated and verified via Client Portal audit controls.</div>
            </div>
            <div style="text-align: right; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 8pt; color: #0f172a; font-weight: 700;">
                REF: ${safeProposalCode}
            </div>
        </div>
    </div>
</body>
</html>`;
}
