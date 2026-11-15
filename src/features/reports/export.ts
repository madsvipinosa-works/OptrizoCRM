import { formatCell, kpiChange, type Period, type ReportDoc, type ReportTable } from "./catalog";

/** What the downloads need to know about a report. A subset of LoadedReport, so tests can build it by hand. */
export interface ExportInput {
    title: string;
    range: string;
    period: Period;
    against: Period | null;
    doc: ReportDoc;
    before: ReportDoc | null;
}

/** "sales-pipeline-report-november-2026" */
export function exportFilename(title: string, ext: "csv" | "pdf") {
    return `${title.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}.${ext}`;
}

// ---------- CSV ----------

/** Text is quoted; numbers are written bare so Excel can add them up. Leading = + - @ would run as a formula, so they get a space. */
function cell(v: string | number | null | undefined): string {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    const text = /^[=+\-@\t\r]/.test(v) ? ` ${v}` : v;
    return `"${text.replace(/"/g, '""')}"`;
}
const row = (...cells: (string | number | null | undefined)[]) => cells.map(cell).join(",");

/** "+20% vs X" reads as a formula in a spreadsheet, so the CSV says "Up 20% vs X". */
function changeWords(text: string) {
    return text.replace(/^\+(\d+)/, "Up $1").replace(/^-(\d+)/, "Down $1");
}

const UNIT_SUFFIX = { count: "", money: " (PHP)", percent: " (%)" } as const;

/**
 * The report as a CSV for Excel: UTF-8 with a byte-order mark (so the peso sign survives), CRLF lines,
 * the period and comparison first, then the key numbers and each table. Amounts are plain numbers.
 */
export function reportCsv(r: ExportInput, generatedBy: string, generatedAt: string): string {
    const lines: string[] = [
        row(r.title),
        row("Period", r.range),
        row("Compared with", r.against ? r.against.label : "No comparison"),
        row("Generated", `${generatedAt} by ${generatedBy}`),
        row("Totals only. No client names."),
        "",
        row("Key numbers"),
    ];

    lines.push(r.against ? row("Measure", "Value", r.against.label, "Change") : row("Measure", "Value"));
    r.doc.kpis.forEach((k, i) => {
        const before = r.before?.kpis[i];
        const change = r.against ? kpiChange(k, before, r.against.label) : null;
        const head = `${k.label}${UNIT_SUFFIX[k.unit]}`;
        lines.push(r.against ? row(head, k.raw, before?.raw ?? null, change ? changeWords(change.text) : "") : row(head, k.raw));
    });

    for (const t of r.doc.tables) {
        lines.push("", row(t.title));
        lines.push(row(...t.columns.map((c, i) => (t.moneyColumns?.includes(i) ? `${c} (PHP)` : c))));
        t.rows.forEach((x) => lines.push(row(...x)));
        if (t.total) lines.push(row(...t.total));
    }

    return `﻿${lines.join("\r\n")}\r\n`;
}

// ---------- PDF (HTML for the browser to print) ----------

const esc = (s: string | number) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function tableHtml(t: ReportTable) {
    const cellHtml = (c: string | number, i: number, tag: "td" | "th" = "td") => `<${tag} class="${i === 0 ? "l" : "r"}">${esc(c)}</${tag}>`;
    const rows = t.rows.map((r) => `<tr>${r.map((c, i) => cellHtml(formatCell(t, i, c), i)).join("")}</tr>`).join("");
    const total = t.total ? `<tr class="total">${t.total.map((c, i) => cellHtml(formatCell(t, i, c), i)).join("")}</tr>` : "";
    return `<section><h2>${esc(t.title)}</h2><table><thead><tr>${t.columns.map((c, i) => cellHtml(c, i, "th")).join("")}</tr></thead><tbody>${rows}${total}</tbody></table></section>`;
}

/** The report as a plain A4 page for the PDF. Everything typed is escaped. */
export function reportHtml(r: ExportInput, generatedBy: string, generatedAt: string): string {
    const kpis = r.doc.kpis
        .map((k, i) => {
            const change = r.against ? kpiChange(k, r.before?.kpis[i], r.against.label) : null;
            const sub = change?.text ?? k.note ?? "";
            return `<div class="kpi"><div class="kl">${esc(k.label)}</div><div class="kv">${esc(k.value)}</div>${sub ? `<div class="kn">${esc(sub)}</div>` : ""}</div>`;
        })
        .join("");

    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;font-size:11px;line-height:1.45}
.org{color:#64748b;font-size:11px}h1{margin:2px 0 4px;font-size:22px;letter-spacing:-.01em}.meta{color:#475569;margin:0 0 18px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px}.kpi{border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px;break-inside:avoid}
.kl{color:#64748b}.kv{font-size:20px;font-weight:600;margin-top:1px}.kn{color:#64748b;margin-top:2px;font-size:10px}
section{margin-top:18px;break-inside:avoid}h2{font-size:14px;margin:0 0 5px}table{width:100%;border-collapse:collapse}
th{color:#64748b;font-weight:500;border-bottom:1px solid #cbd5e1;padding:5px 0}td{border-bottom:1px solid #e2e8f0;padding:6px 0}
.l{text-align:left}.r{text-align:right;font-variant-numeric:tabular-nums}.total td{font-weight:600}
</style></head><body>
<div class="org">Optrizo Digital Solutions</div><h1>${esc(r.title)}</h1>
<p class="meta">${esc(r.range)}${r.against ? ` · compared with ${esc(r.against.label)}` : ""} · generated ${esc(generatedAt)} by ${esc(generatedBy)}</p>
<div class="kpis">${kpis}</div>${r.doc.tables.map(tableHtml).join("")}
</body></html>`;
}
