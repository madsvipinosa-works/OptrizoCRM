import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { NextRequest } from "next/server";

vi.mock("@/auth", async () => (await import("../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../helpers/mock-db")).createMockDb() }));
vi.mock("@/lib/pdf-generator", () => ({ getPuppeteerBrowser: vi.fn() }));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("next/navigation", () => ({
    redirect: (url: string) => {
        throw new Error(`REDIRECT:${url}`);
    },
}));

import { auth } from "@/auth";
import { db } from "@/db";
import { logAction } from "@/features/audit/log";
import { groupOptions, readOptions } from "@/components/ui/form-select";
import {
    comparePeriod,
    customPeriod,
    kpiChange,
    parsePeriod,
    periodOptions,
    periodRangeText,
    type ReportDoc,
    type ReportKpi,
} from "@/features/reports/catalog";
import { buildReport, weeksOf, whoSignedIn } from "@/features/reports/builders";
import { generateReport } from "@/features/reports/generate-action";
import { loadReport } from "@/features/reports/load";
import { exportFilename, reportCsv, reportHtml, type ExportInput } from "@/features/reports/export";
import { GET } from "@/app/api/reports/export/route";
import { ROLES, signInAs } from "../helpers/mock-auth";
import type { MockDb } from "../helpers/mock-db";

const mockDb = db as unknown as MockDb;
const iso = (s: string) => new Date(s);

beforeEach(() => {
    mockDb.resetMocks();
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("FormSelect option groups", () => {
    it("reads options inside <optgroup> with their group label", () => {
        const children = [
            React.createElement("optgroup", { key: "m", label: "Months" }, [
                React.createElement("option", { key: "a", value: "m:2026-11" }, "November 2026"),
                React.createElement("option", { key: "b", value: "m:2026-10" }, "October 2026"),
            ]),
            React.createElement("optgroup", { key: "q", label: "Quarters" }, React.createElement("option", { value: "q:2026-4" }, "Q4 2026")),
        ];
        const options = readOptions(children);
        expect(options.map((o) => [o.value, o.group])).toEqual([
            ["m:2026-11", "Months"],
            ["m:2026-10", "Months"],
            ["q:2026-4", "Quarters"],
        ]);
        expect(groupOptions(options).map((g) => [g.group, g.items.length])).toEqual([["Months", 2], ["Quarters", 1]]);
    });

    it("leaves a flat list ungrouped", () => {
        const options = readOptions([React.createElement("option", { key: "a", value: "a" }, "A"), React.createElement("option", { key: "b", value: "b" }, "B")]);
        expect(groupOptions(options)).toHaveLength(1);
        expect(groupOptions(options)[0].group).toBeUndefined();
    });
});

describe("periods are in Manila time", () => {
    it("November 2026 runs from Nov 1 00:00 to Nov 30 23:59:59.999 Manila", () => {
        const p = parsePeriod("m:2026-11")!;
        expect(p.from.toISOString()).toBe("2026-10-31T16:00:00.000Z");
        expect(p.to.toISOString()).toBe("2026-11-30T15:59:59.999Z");
        expect(p.label).toBe("November 2026");
        expect(periodRangeText(p)).toBe("Nov 1 – 30, 2026");
    });

    it("a quarter spans three months, and February has its own length", () => {
        const q = parsePeriod("q:2026-4")!;
        expect(q.fromYmd).toBe("2026-10-01");
        expect(q.toYmd).toBe("2026-12-31");
        expect(periodRangeText(q)).toBe("Oct 1 – Dec 31, 2026");
        expect(parsePeriod("m:2028-2")!.toYmd).toBe("2028-02-29");
    });

    it("rejects months and quarters that do not exist", () => {
        expect(parsePeriod("m:2026-13")).toBeNull();
        expect(parsePeriod("q:2026-5")).toBeNull();
        expect(parsePeriod("nonsense")).toBeNull();
        expect(parsePeriod(null)).toBeNull();
    });

    it("lists the running month first, and a moment after midnight in Manila is already the next month", () => {
        const items = periodOptions(iso("2026-11-15T17:00:00Z"))[0].items;
        expect(items[0]).toEqual({ value: "m:2026-11", label: "November 2026 (so far)" });
        expect(items[1].value).toBe("m:2026-10");
        expect(items).toHaveLength(12);

        // 17:00 UTC on Oct 31 is 01:00 on Nov 1 in Manila.
        expect(periodOptions(iso("2026-10-31T17:00:00Z"))[0].items[0].value).toBe("m:2026-11");
        expect(periodOptions(iso("2026-10-31T15:00:00Z"))[0].items[0].value).toBe("m:2026-10");
    });

    it("lists quarters across a year boundary", () => {
        const quarters = periodOptions(iso("2026-02-10T00:00:00Z"))[1].items;
        expect(quarters.map((q) => q.value)).toEqual(["q:2026-1", "q:2025-4", "q:2025-3", "q:2025-2"]);
    });

    it("compares with the previous period, across a year boundary, and with last year", () => {
        expect(comparePeriod(parsePeriod("m:2026-01")!, "previous")?.value).toBe("m:2025-12");
        expect(comparePeriod(parsePeriod("q:2026-1")!, "previous")?.value).toBe("q:2025-4");
        expect(comparePeriod(parsePeriod("m:2026-11")!, "year")?.value).toBe("m:2025-11");
        expect(comparePeriod(parsePeriod("m:2026-11")!, "none")).toBeNull();
    });

    it("splits a period into Monday-to-Sunday weeks cut to the period", () => {
        const weeks = weeksOf(parsePeriod("m:2026-11")!);
        expect(weeks.map((w) => w.label)).toEqual(["Nov 1", "Nov 2 – 8", "Nov 9 – 15", "Nov 16 – 22", "Nov 23 – 29", "Nov 30"]);
        expect(weeks[0].from.toISOString()).toBe("2026-10-31T16:00:00.000Z");
        expect(weeks.at(-1)!.to.toISOString()).toBe("2026-11-30T15:59:59.999Z");
    });
});

const kpi = (raw: number | null, unit: ReportKpi["unit"] = "count"): ReportKpi => ({ label: "x", value: String(raw), raw, unit });

describe("kpiChange", () => {
    it("says nothing when nothing is compared", () => {
        expect(kpiChange(kpi(3), undefined, "October 2026")).toBeNull();
    });

    it("explains a missing comparison instead of printing a zero", () => {
        expect(kpiChange(kpi(3, "percent"), kpi(null, "percent"), "October 2026")?.text).toBe("No data for October 2026");
    });

    it("gives a percent change, a rise from zero, points for rates, and no change", () => {
        expect(kpiChange(kpi(6), kpi(5), "October 2026")).toEqual({ text: "+20% vs October 2026", direction: "up" });
        expect(kpiChange(kpi(4), kpi(5), "October 2026")).toEqual({ text: "-20% vs October 2026", direction: "down" });
        expect(kpiChange(kpi(6), kpi(0), "October 2026")?.text).toBe("Up from 0 in October 2026");
        expect(kpiChange(kpi(80, "percent"), kpi(70, "percent"), "October 2026")?.text).toBe("+10 points vs October 2026");
        expect(kpiChange(kpi(5), kpi(5), "October 2026")).toEqual({ text: "Same as October 2026", direction: "flat" });
    });
});

describe("report counting", () => {
    it("counts a revised proposal once per client, by its latest version", async () => {
        mockDb.setSelectRows([
            { leadId: "a", status: "replaced", version: 1, sentAt: iso("2026-11-03T02:00:00Z") },
            { leadId: "a", status: "signed", version: 2, sentAt: iso("2026-11-05T02:00:00Z") },
            { leadId: "b", status: "sent", version: 1, sentAt: iso("2026-11-04T02:00:00Z") },
            { leadId: "c", status: "draft", version: 1, sentAt: null },
        ]);
        const doc = await buildReport("proposals", parsePeriod("m:2026-11")!);
        const byLabel = Object.fromEntries(doc.kpis.map((k) => [k.label, k]));

        expect(byLabel["Proposals sent"].raw).toBe(2);
        expect(byLabel["Signed"].raw).toBe(1);
        expect(byLabel["Declined"].raw).toBe(0);
        expect(byLabel["Win rate"]).toMatchObject({ raw: 100, value: "100%", note: "1 still waiting" });
        expect(doc.events).toBe(3);
    });

    it("counts a lead lost in the period even if it was created earlier", async () => {
        mockDb.setSelectRows([
            { status: "Closed Lost", source: "Website Form", createdAt: iso("2026-10-10T02:00:00Z"), stageChangedAt: iso("2026-11-08T02:00:00Z"), closedWonAt: null },
            { status: "Closed Won", source: "Website Form", createdAt: iso("2026-11-02T02:00:00Z"), stageChangedAt: iso("2026-11-06T02:00:00Z"), closedWonAt: iso("2026-11-06T02:00:00Z") },
        ]);
        const doc = await buildReport("sales_pipeline", parsePeriod("m:2026-11")!);
        const byLabel = Object.fromEntries(doc.kpis.map((k) => [k.label, k]));

        expect(byLabel["New leads"].raw).toBe(1);
        expect(byLabel["Won"].raw).toBe(1);
        expect(byLabel["Win rate"]).toMatchObject({ raw: 50, note: "1 won, 1 lost" });
    });

    it("reports no activity for a period with nothing in it", async () => {
        mockDb.setSelectRows([]);
        const doc = await buildReport("payments", parsePeriod("m:2026-10")!);
        expect(doc.events).toBe(0);
        expect(doc.kpis.find((k) => k.label === "Collected")?.raw).toBe(0);
    });

    it("keeps pesos as plain numbers in payment tables", async () => {
        mockDb.setSelectRows([
            { label: "On signing", percent: 30, amount: 30000, currency: "PHP", status: "paid", receivedAt: iso("2026-11-03T02:00:00Z"), dueDate: iso("2026-11-10T02:00:00Z") },
        ]);
        const doc = await buildReport("payments", parsePeriod("m:2026-11")!);
        expect(doc.kpis[0]).toMatchObject({ label: "Collected", raw: 30000, unit: "money", value: "₱30,000" });
        expect(doc.tables[0].moneyColumns).toEqual([2]);
        expect(doc.tables[0].total).toEqual(["Total", 1, 30000]);
    });
});

const input = (overrides: Partial<ExportInput> = {}): ExportInput => {
    const period = parsePeriod("m:2026-11")!;
    const doc: ReportDoc = {
        events: 5,
        kpis: [
            { label: "Collected", value: "₱99,600", raw: 99600, unit: "money", tone: "brand" },
            { label: "Win rate", value: "100%", raw: 100, unit: "percent" },
        ],
        tables: [{ title: 'By "stage"', columns: ["Stage", "Payments", "Amount"], rows: [["On signing, 30%", 5, 99600], ["=SUM(A1)", 0, 0]], total: ["Total", 5, 99600], moneyColumns: [2] }],
    };
    return { title: "Payments report · November 2026", range: periodRangeText(period), period, against: null, doc, before: null, ...overrides };
};

describe("CSV", () => {
    it("starts with a byte-order mark, writes pesos as numbers and quotes text", () => {
        const csv = reportCsv(input(), "Super Admin", "Nov 16, 2026");
        expect(csv.startsWith("﻿")).toBe(true);
        expect(csv).toContain('"Collected (PHP)",99600');
        expect(csv).toContain('"Win rate (%)",100');
        expect(csv).toContain('"Stage","Payments","Amount (PHP)"');
        expect(csv).toContain('"On signing, 30%",5,99600');
        expect(csv).toContain('"Total",5,99600');
        expect(csv).toContain('"Period","Nov 1 – 30, 2026"');
        expect(csv).toContain("\r\n");
        expect(csv).not.toContain("₱");
    });

    it("stops text that looks like a formula from running", () => {
        expect(reportCsv(input(), "Super Admin", "Nov 16, 2026")).toContain('" =SUM(A1)"');
    });

    it("adds the comparison columns, with words instead of a leading plus", () => {
        const against = parsePeriod("m:2026-10")!;
        const before: ReportDoc = { events: 1, kpis: [{ label: "Collected", value: "₱83,000", raw: 83000, unit: "money" }, { label: "Win rate", value: "No data", raw: null, unit: "percent" }], tables: [] };
        const csv = reportCsv(input({ against, before }), "Super Admin", "Nov 16, 2026");
        expect(csv).toContain('"Measure","Value","October 2026","Change"');
        expect(csv).toContain('"Collected (PHP)",99600,83000,"Up 20% vs October 2026"');
        expect(csv).toContain('"Win rate (%)",100,,"No data for October 2026"');
    });

    it("names the file from the title", () => {
        expect(exportFilename("Payments report · November 2026", "csv")).toBe("payments-report-november-2026.csv");
    });
});

describe("PDF page", () => {
    it("shows the numbers with pesos and escapes what could be markup", () => {
        const html = reportHtml(input({ title: "<b>Payments</b> report" }), "Super Admin", "Nov 16, 2026");
        expect(html).toContain("&lt;b&gt;Payments&lt;/b&gt; report");
        expect(html).not.toContain("<b>Payments</b>");
        expect(html).toContain("₱99,600");
        expect(html).toContain("By &quot;stage&quot;");
        expect(html).toContain("Nov 1 – 30, 2026");
    });
});

describe("GET /api/reports/export", () => {
    const call = (qs: string) => GET(new NextRequest(`http://localhost/api/reports/export?${qs}`));

    it.each(ROLES.filter((r) => r !== "superadmin"))("refuses %s", async (role) => {
        signInAs(auth, role);
        expect((await call("format=csv&type=payments&period=m:2026-11")).status).toBe(403);
    });

    it("refuses a signed-out caller", async () => {
        signInAs(auth, null);
        expect((await call("format=csv&type=payments&period=m:2026-11")).status).toBe(403);
    });

    it("rejects a bad format, type or period", async () => {
        signInAs(auth, "superadmin");
        expect((await call("format=xlsx&type=payments&period=m:2026-11")).status).toBe(400);
        expect((await call("format=csv&type=secrets&period=m:2026-11")).status).toBe(400);
        expect((await call("format=csv&type=payments&period=m:2026-13")).status).toBe(400);
    });

    it("sends a CSV file for the Super Admin", async () => {
        signInAs(auth, "superadmin");
        mockDb.setSelectRows([]);
        const res = await call("format=csv&type=payments&period=m:2026-11&compare=none");
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/csv");
        expect(res.headers.get("content-disposition")).toContain("payments-report-november-2026.csv");
        const text = await res.text();
        expect(text).toContain("Payments report");
        expect(text).toContain("No comparison");
    });
});

describe("custom range", () => {
    it("is two Manila days, inclusive", () => {
        const p = parsePeriod("r:2026-11-01_2026-11-15")!;
        expect(p.kind).toBe("custom");
        expect(p.label).toBe("Nov 1 – 15, 2026");
        expect(p.from.toISOString()).toBe("2026-10-31T16:00:00.000Z");
        expect(p.to.toISOString()).toBe("2026-11-15T15:59:59.999Z");
    });

    it("can be one day, or cross New Year", () => {
        expect(customPeriod("2026-11-05", "2026-11-05")?.label).toBe("Nov 5, 2026");
        expect(customPeriod("2026-12-20", "2027-01-05")?.label).toBe("Dec 20, 2026 – Jan 5, 2027");
    });

    it("rejects reversed dates, dates that do not exist, bad text and more than a year", () => {
        expect(customPeriod("2026-11-15", "2026-11-01")).toBeNull();
        expect(customPeriod("2026-02-31", "2026-03-05")).toBeNull();
        expect(customPeriod("tomorrow", "2026-03-05")).toBeNull();
        expect(customPeriod("2026-01-01", "2026-12-31")).not.toBeNull();
        expect(customPeriod("2026-01-01", "2027-01-02")).toBeNull();
        expect(parsePeriod("r:2026-11-15_2026-11-01")).toBeNull();
    });

    it("compares with the same number of days just before it, or the same days last year", () => {
        const p = parsePeriod("r:2026-11-01_2026-11-15")!;
        expect(comparePeriod(p, "previous")?.value).toBe("r:2026-10-17_2026-10-31");
        expect(comparePeriod(p, "year")?.value).toBe("r:2025-11-01_2025-11-15");
        expect(comparePeriod(parsePeriod("r:2028-02-20_2028-02-29")!, "year")?.value).toBe("r:2027-02-20_2027-02-28");
    });

    it("is offered in the Period list as its own choice", () => {
        const groups = periodOptions(iso("2026-11-15T17:00:00Z"));
        expect(groups.at(-1)).toEqual({ group: "Custom", items: [{ value: "custom", label: "Custom range…" }] });
    });
});

describe("generate report", () => {
    const form = (fields: Record<string, string>) => {
        const f = new FormData();
        Object.entries(fields).forEach(([k, v]) => f.append(k, v));
        return f;
    };
    const run = async (fields: Record<string, string>) => {
        try {
            await generateReport(form(fields));
        } catch (e) {
            return (e as Error).message;
        }
        return "no redirect";
    };

    it("opens a custom range report and records it", async () => {
        signInAs(auth, "superadmin");
        const out = await run({ type: "payments", period: "custom", from: "2026-11-01", to: "2026-11-15", compare: "previous" });
        expect(out).toBe("REDIRECT:/dashboard/reports/view?type=payments&period=r%3A2026-11-01_2026-11-15&compare=previous");
        expect(logAction).toHaveBeenCalledWith("CREATE", "Report", "type=payments;period=r:2026-11-01_2026-11-15;compare=previous");
    });

    it("sends a bad custom range back with a reason and records nothing", async () => {
        signInAs(auth, "superadmin");
        expect(await run({ type: "payments", period: "custom", from: "2026-11-15", to: "2026-11-01" })).toBe("REDIRECT:/dashboard/reports?problem=range");
        expect(await run({ type: "payments", period: "custom", from: "", to: "" })).toBe("REDIRECT:/dashboard/reports?problem=range");
        expect(logAction).not.toHaveBeenCalled();
    });

    it("still takes a month from the list, and refuses anyone but Super Admin", async () => {
        signInAs(auth, "superadmin");
        expect(await run({ type: "proposals", period: "m:2026-11" })).toContain("period=m%3A2026-11");
        signInAs(auth, "manager");
        expect(await run({ type: "proposals", period: "m:2026-11" })).toBe("REDIRECT:/dashboard");
    });
});

describe("comparing a period that is still running", () => {
    it("uses the same days of the other period, not all of it", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-16T04:00:00Z")); // 15.5 days into November, Manila
        mockDb.setSelectRows([]);

        const report = (await loadReport("payments", "m:2026-11", "previous"))!;

        expect(report.against?.label).toBe("October 2026 (same days)");
        expect(report.against?.to.toISOString()).toBe("2026-10-16T04:00:00.000Z");
    });

    it("compares a finished period with all of the other", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-16T04:00:00Z"));
        mockDb.setSelectRows([]);

        const report = (await loadReport("payments", "m:2026-10", "previous"))!;
        expect(report.against?.label).toBe("September 2026");
        expect(report.against?.to.toISOString()).toBe("2026-09-30T15:59:59.999Z");
    });
});

describe("measures taken as of today", () => {
    const milestone = (endDate: string) => ({ status: "Pending", endDate: iso(endDate), completedAt: null, startDate: null, createdAt: iso("2026-10-01T00:00:00Z") });

    it("counts a milestone as delayed only once its end date has passed, even in a running month", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-16T04:00:00Z"));

        mockDb.setSelectRows([milestone("2026-11-20T00:00:00Z")]);
        const later = await buildReport("project_status", parsePeriod("m:2026-11")!);
        expect(later.kpis.find((k) => k.label === "Delayed now")?.raw).toBe(0);

        mockDb.setSelectRows([milestone("2026-11-10T00:00:00Z")]);
        const past = await buildReport("project_status", parsePeriod("m:2026-11")!);
        expect(past.kpis.find((k) => k.label === "Delayed now")?.raw).toBe(1);
    });

    it("measures days in a stage up to today, not to the end of the month", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-16T04:00:00Z"));
        mockDb.setSelectRows([{ status: "New Lead", source: "Website Form", createdAt: iso("2026-11-10T04:00:00Z"), stageChangedAt: iso("2026-11-10T04:00:00Z"), closedWonAt: null }]);

        const doc = await buildReport("sales_pipeline", parsePeriod("m:2026-11")!);
        expect(doc.tables[0].rows[0]).toEqual(["New lead", 1, "6.0 days"]);
    });
});

describe("who signed in", () => {
    it("uses the user when the record has one, else the email in its details", () => {
        expect(whoSignedIn({ userId: "u1", details: "Email login: a@b.com" })).toBe("u1");
        expect(whoSignedIn({ userId: null, details: "Email login: PM@Optrizo.com" })).toBe("email:pm@optrizo.com");
        expect(whoSignedIn({ userId: null, details: "Email login:  pm@optrizo.com " })).toBe("email:pm@optrizo.com");
    });

    it("skips records it cannot tell apart", () => {
        expect(whoSignedIn({ userId: null, details: "something else" })).toBeNull();
        expect(whoSignedIn({ userId: null, details: null })).toBeNull();
    });

    it("counts each person once in the System usage report", async () => {
        mockDb.setSelectRows([
            { userId: null, details: "Email login: pm@optrizo.com", createdAt: iso("2026-11-03T02:00:00Z"), status: "active", severity: "HIGH" },
            { userId: null, details: "Email login: PM@optrizo.com", createdAt: iso("2026-11-04T02:00:00Z"), status: "active", severity: "HIGH" },
            { userId: null, details: "Email login: sales@optrizo.com", createdAt: iso("2026-11-04T03:00:00Z"), status: "active", severity: "HIGH" },
            { userId: "u9", details: "Email login: dev@optrizo.com", createdAt: iso("2026-11-05T02:00:00Z"), status: "active", severity: "HIGH" },
        ]);
        const doc = await buildReport("system_usage", parsePeriod("m:2026-11")!);
        const byLabel = Object.fromEntries(doc.kpis.map((k) => [k.label, k]));
        expect(byLabel["People who signed in"].raw).toBe(3);
        expect(byLabel["Sign-ins"].raw).toBe(4);
    });
});

describe("GET /api/reports/export with a custom range", () => {
    it("names the file from the dates", async () => {
        signInAs(auth, "superadmin");
        mockDb.setSelectRows([]);
        const res = await GET(new NextRequest("http://localhost/api/reports/export?format=csv&type=payments&period=r:2026-11-01_2026-11-15&compare=previous"));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-disposition")).toContain("payments-report-nov-1-15-2026.csv");
        const text = await res.text();
        expect(text).toContain("Nov 1 – 15, 2026");
        expect(text).toContain("Oct 17 – 31, 2026");
    });
});
