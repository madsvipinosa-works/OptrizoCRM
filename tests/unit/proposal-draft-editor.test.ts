import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    buildSavePayload,
    canCreateRevision,
    formatDayMonth,
    getSendProblems,
    getStepper,
    isEditableStatus,
    isStandardTerms,
    milestoneRangeSummary,
    readOnlyMessage,
    scheduleSummary,
    scheduleTotalPercent,
    toDateInput,
    validateDraftFields,
    validateMilestoneDates,
    validateSchedule,
    type DraftFields,
    type MilestoneDraft,
    type ScheduleDraftItem,
} from "@/features/proposals/draft-logic";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

const STATUSES = ["draft", "sent", "pricing_meeting_requested", "changes_requested", "signed", "declined", "replaced"] as const;

const milestone = (key: string, startDate: string, endDate: string): MilestoneDraft => ({
    key,
    title: key,
    description: "",
    startDate,
    endDate,
});

const goodMilestones: MilestoneDraft[] = [
    milestone("requirements", "2026-11-06", "2026-11-12"),
    milestone("design", "2026-11-13", "2026-11-26"),
    milestone("development", "2026-11-27", "2027-01-07"),
    milestone("uat_testing", "2027-01-08", "2027-01-21"),
    milestone("handover", "2027-01-22", "2027-01-28"),
];

const goodSchedule: ScheduleDraftItem[] = [
    { label: "On signing", percent: 30, trigger: "on_signing" },
    { label: "After design approval", percent: 30, trigger: "design" },
    { label: "On handover", percent: 40, trigger: "handover" },
];

const fields = (overrides: Partial<DraftFields> = {}): DraftFields => ({
    projectName: "Delivery Tracking App",
    overview: "A mobile app and dashboard to track deliveries.",
    solution: "Driver app and dispatcher dashboard.",
    exclusions: "Hosting costs",
    needs: "Track deliveries",
    goals: "Fewer late deliveries",
    priceMode: "to_be_discussed",
    currency: "PHP",
    totalPrice: null,
    validUntil: "2026-11-19",
    terms: "",
    ...overrides,
});

describe("read-only mode by status", () => {
    it("only a draft is editable", () => {
        for (const status of STATUSES) expect(isEditableStatus(status)).toBe(status === "draft");
    });

    it("every locked status explains why, a draft has no message", () => {
        expect(readOnlyMessage("draft")).toBeNull();
        for (const status of STATUSES.filter((s) => s !== "draft")) {
            expect(readOnlyMessage(status)).toEqual(expect.any(String));
        }
        expect(readOnlyMessage("sent")).toMatch(/locked.*create a new version/i);
        expect(readOnlyMessage("signed")).toMatch(/cannot be changed/);
    });

    it("a new version can be created only from a sent version that is still open", () => {
        for (const status of STATUSES) {
            expect(canCreateRevision(status)).toBe(["sent", "pricing_meeting_requested", "changes_requested"].includes(status));
        }
    });
});

describe("stepper", () => {
    const states = (status: string, version = 1) => getStepper(status, version).map((s) => s.state);

    it("shows Draft as current while drafting", () => {
        expect(states("draft")).toEqual(["current", "upcoming", "upcoming"]);
    });

    it("moves to Sent once it has been sent", () => {
        for (const status of ["sent", "pricing_meeting_requested", "changes_requested"]) {
            expect(states(status)).toEqual(["done", "current", "upcoming"]);
        }
    });

    it("marks everything done when signed", () => {
        expect(states("signed")).toEqual(["done", "done", "done"]);
    });

    it("names the version for v2 and later", () => {
        expect(getStepper("draft", 1)[0].label).toBe("1. Draft (PM)");
        expect(getStepper("draft", 2)[0].label).toBe("1. Draft v2 (PM)");
    });
});

describe("dates", () => {
    it("toDateInput gives the UTC calendar day, or empty", () => {
        expect(toDateInput(new Date("2026-11-06T00:00:00.000Z"))).toBe("2026-11-06");
        expect(toDateInput("2026-11-06T00:00:00.000Z")).toBe("2026-11-06");
        expect(toDateInput(null)).toBe("");
        expect(toDateInput("not a date")).toBe("");
    });

    it("formatDayMonth does no timezone maths", () => {
        expect(formatDayMonth("2026-11-06")).toBe("Nov 6");
        expect(formatDayMonth("2027-03-10")).toBe("Mar 10");
        expect(formatDayMonth("")).toBe("");
    });

    it("milestoneRangeSummary shows the first and last date", () => {
        expect(milestoneRangeSummary(goodMilestones)).toBe("5 default milestones · Nov 6 – Jan 28");
        expect(milestoneRangeSummary(goodMilestones.map((m) => ({ ...m, startDate: "", endDate: "" })))).toBe(
            "5 default milestones · Dates not set",
        );
    });
});

describe("milestone date validation", () => {
    it("accepts 5 complete dates that run in order", () => {
        expect(validateMilestoneDates(goodMilestones)).toEqual({ ok: true, errors: {} });
    });

    it("allows a milestone to start on the day the previous one ends", () => {
        const sameDay = goodMilestones.map((m) => ({ ...m }));
        sameDay[1].startDate = sameDay[0].endDate;
        expect(validateMilestoneDates(sameDay).ok).toBe(true);
    });

    it("requires a start and an end date for every milestone", () => {
        const missing = goodMilestones.map((m) => ({ ...m }));
        missing[2].endDate = "";
        const result = validateMilestoneDates(missing);
        expect(result.ok).toBe(false);
        expect(result.errors.development).toMatch(/start date and an end date/);
    });

    it("rejects an end date before the start date", () => {
        const backwards = goodMilestones.map((m) => ({ ...m }));
        backwards[0].endDate = "2026-11-01";
        const result = validateMilestoneDates(backwards);
        expect(result.errors.requirements).toMatch(/on or after the start date/);
    });

    it("rejects a milestone that starts before the previous one ends", () => {
        const overlapping = goodMilestones.map((m) => ({ ...m }));
        overlapping[1].startDate = "2026-11-10";
        const result = validateMilestoneDates(overlapping);
        expect(result.ok).toBe(false);
        expect(result.errors.design).toMatch(/run in order/);
        expect(Object.keys(result.errors)).toEqual(["design"]);
    });
});

describe("payment schedule", () => {
    it("totals the percents", () => {
        expect(scheduleTotalPercent(goodSchedule)).toBe(100);
        expect(scheduleTotalPercent([{ percent: 33.5 }, { percent: Number.NaN }])).toBe(33.5);
    });

    it("is valid only at exactly 100% with a name on every payment", () => {
        expect(validateSchedule(goodSchedule)).toEqual({ ok: true, message: null });
        expect(validateSchedule([{ ...goodSchedule[0], percent: 90 }]).message).toMatch(/100% \(now 90%\)/);
        expect(validateSchedule([{ ...goodSchedule[0], percent: 110 }]).ok).toBe(false);
        expect(validateSchedule([]).message).toMatch(/at least one payment/i);
        expect(validateSchedule([{ label: "  ", percent: 100, trigger: "on_signing" }]).message).toMatch(/needs a name/);
    });

    it("summarises the schedule", () => {
        expect(scheduleSummary(goodSchedule)).toBe("3 payments · 30% on signing, 30% after design approval, 40% on handover");
        expect(scheduleSummary([])).toBe("No payments set");
    });
});

describe("terms", () => {
    it("treats empty and the seeded text as standard terms", () => {
        expect(isStandardTerms("")).toBe(true);
        expect(isStandardTerms(null)).toBe(true);
        expect(isStandardTerms("Standard Agency Terms: Commercial terms and payment schedule to be finalized.")).toBe(true);
        expect(isStandardTerms("Payment is due within 7 days.")).toBe(false);
    });
});

describe("field limits", () => {
    it("flags fields that are too long", () => {
        const errors = validateDraftFields(
            fields({ projectName: "x".repeat(121), overview: "x".repeat(5001), exclusions: "x".repeat(2001), totalPrice: -5 }),
        );
        expect(Object.keys(errors).sort()).toEqual(["exclusions", "overview", "projectName", "totalPrice"]);
        expect(validateDraftFields(fields())).toEqual({});
    });
});

describe("what blocks Send to client", () => {
    const base = { milestones: goodMilestones, schedule: goodSchedule, today: "2026-11-06" };

    it("lets a complete draft go", () => {
        expect(getSendProblems({ ...base, fields: fields() })).toEqual([]);
        expect(getSendProblems({ ...base, fields: fields({ priceMode: "priced", totalPrice: 300000 }) })).toEqual([]);
    });

    it("needs a project name and an overview", () => {
        const problems = getSendProblems({ ...base, fields: fields({ projectName: " ", overview: "" }) });
        expect(problems).toEqual(["Add a project name.", "Add the project overview."]);
    });

    it("needs all 5 milestone dates", () => {
        const problems = getSendProblems({ ...base, fields: fields(), milestones: goodMilestones.map((m) => ({ ...m, endDate: "" })) });
        expect(problems.join(" ")).toMatch(/milestone dates/);
    });

    it("a priced proposal needs a price above 0 and a schedule that totals 100%", () => {
        const noPrice = getSendProblems({ ...base, fields: fields({ priceMode: "priced", totalPrice: 0 }) });
        expect(noPrice.join(" ")).toMatch(/total price above 0/);

        const badSchedule = getSendProblems({
            ...base,
            fields: fields({ priceMode: "priced", totalPrice: 1000 }),
            schedule: [{ ...goodSchedule[0], percent: 80 }],
        });
        expect(badSchedule.join(" ")).toMatch(/Payment schedule: Percents must add up to 100%/);
    });

    it("does not check the schedule for a price-to-be-discussed version", () => {
        expect(getSendProblems({ ...base, fields: fields(), schedule: [] })).toEqual([]);
    });

    it("needs a valid-until date that has not passed", () => {
        expect(getSendProblems({ ...base, fields: fields({ validUntil: "" }) })).toContain("Set a Valid until date.");
        expect(getSendProblems({ ...base, fields: fields({ validUntil: "2026-11-05" }) })).toContain("The Valid until date has passed.");
        expect(getSendProblems({ ...base, fields: fields({ validUntil: "2026-11-06" }) })).toEqual([]);
    });
});

describe("what Save draft sends", () => {
    it("keeps the legacy totals in step with the price, and drops discount and tax", () => {
        const priced = buildSavePayload(fields({ priceMode: "priced", totalPrice: 300000, currency: "USD" }));
        expect(priced).toMatchObject({ priceMode: "priced", currency: "USD", totalPrice: 300000, subtotal: 300000, total: 300000, discount: 0, tax: 0 });

        const unpriced = buildSavePayload(fields({ priceMode: "to_be_discussed", totalPrice: 300000 }));
        expect(unpriced).toMatchObject({ totalPrice: null, subtotal: 0, total: 0 });
    });

    it("maps the labels to the real columns: overview is scope, solution is technicalApproach", () => {
        const payload = buildSavePayload(fields());
        expect(payload.scope).toBe("A mobile app and dashboard to track deliveries.");
        expect(payload.technicalApproach).toBe("Driver app and dispatcher dashboard.");
        expect(payload.exclusions).toBe("Hosting costs");
        expect(payload.projectName).toBe("Delivery Tracking App");
        expect(payload.needsGoals).toEqual({ needs: "Track deliveries", goals: "Fewer late deliveries" });
    });

    it("stores valid-until as UTC midnight of the chosen day", () => {
        expect(buildSavePayload(fields({ validUntil: "2026-11-19" })).validUntil?.toISOString()).toBe("2026-11-19T00:00:00.000Z");
        expect(buildSavePayload(fields({ validUntil: "" })).validUntil).toBeNull();
    });

    it("never sends the fields the editor no longer edits", () => {
        const keys = Object.keys(buildSavePayload(fields()));
        for (const removed of ["pricingStructure", "deliverables", "contractSettings", "proposalCode", "timeline"]) {
            expect(keys).not.toContain(removed);
        }
    });
});

describe("the editor (source checks, because components are not rendered here)", () => {
    const editor = read("src/features/proposals/components/ProposalDraftEditor.tsx");
    const dialogs = read("src/features/proposals/components/draft-dialogs.tsx");

    it("has the three buttons, the preview page and the new-version button", () => {
        for (const text of ["Send to client", "Preview document", "Save draft", "Back to editing", "Create new version"]) {
            expect(editor).toContain(text);
        }
        expect(editor).toContain("createProposalRevision(");
        expect(editor).toContain("sendProposal(");
        expect(editor).toContain("ProposalDocumentSheet");
    });

    it("opens every dialog, including Scope and timeline and the Edit schedule dialog that was never reachable before", () => {
        for (const name of ["needs", "milestones", "scope", "standard", "schedule", "terms", "send"]) {
            expect(editor).toContain(`setDialog("${name}")`);
        }
    });

    it("locks every input when the status is not draft", () => {
        expect(editor).toContain("const editable = isEditableStatus(data.status)");
        for (const id of ["project-name", "overview", "solution", "exclusions", "currency", "total-price", "valid-until"]) {
            const at = editor.indexOf(`id="${id}"`);
            expect(at, id).toBeGreaterThan(-1);
            expect(editor.slice(at, at + 300), id).toContain("disabled={!editable}");
        }
        // The two price mode buttons are locked too.
        expect((editor.match(/disabled=\{!editable\}\s+aria-pressed/g) ?? []).length).toBe(2);
        // The send and save buttons only exist for a draft.
        expect(editor).toMatch(/\{editable && \(\s*<Button[^>]*onClick=\{\(\) => \{ setSendError/);
    });

    it("no longer has templates, deliverables, line items, discount, tax, contract settings, share, email or PDF", () => {
        for (const removed of [
            "TEMPLATES",
            "Deliverable",
            "line item",
            "Discount",
            "Contract Settings",
            "Share",
            "sendProposalEmail",
            "printProposalPdf",
            "Download PDF",
        ]) {
            expect(editor).not.toContain(removed);
            expect(dialogs).not.toContain(removed);
        }
    });

    it("milestones can only change dates: the dialog has no add or remove for milestones", () => {
        const start = dialogs.indexOf("export function MilestonesDialog");
        const end = dialogs.indexOf("export function ScopeTimelineDialog");
        const body = dialogs.slice(start, end);
        expect(body).not.toMatch(/Add milestone|Remove|\.filter\(\(_, i\)/);
        expect(body).toContain("validateMilestoneDates(");
    });

    it("the old Studio and its PDF helper are gone", () => {
        expect(existsSync(resolve(process.cwd(), "src/features/proposals/components/ProposalBuilderStudio.tsx"))).toBe(false);
        expect(existsSync(resolve(process.cwd(), "src/features/proposals/utils/printProposalPdf.ts"))).toBe(false);
    });

    it("the builder page is manager-only through requireRole", () => {
        const page = read("src/app/(admin)/dashboard/proposals/builder/[id]/page.tsx");
        expect(page).toContain('requireRole(["manager"])');
        expect(page).toContain("ProposalDraftEditor");
        expect(page).not.toContain("ProposalBuilderStudio");
    });
});

describe("Super Admin never opens proposals", () => {
    it.each([
        "src/app/(admin)/dashboard/proposals/page.tsx",
        "src/app/(admin)/dashboard/proposals/[id]/page.tsx",
        "src/app/(admin)/dashboard/proposals/builder/[id]/page.tsx",
    ])("%s does not allow superadmin", (file) => {
        const roleChecks = read(file).match(/(hasRole|requireRole)\([^)]*\)/g) ?? [];
        expect(roleChecks.length).toBeGreaterThan(0);
        for (const check of roleChecks) expect(check).not.toContain("superadmin");
    });
});

describe("the client and document views show the new fields", () => {
    it("the document sheet, client view, staff view and PDF read projectName and exclusions", () => {
        expect(read("src/features/proposals/components/ProposalDocumentSheet.tsx")).toContain("data.exclusions");
        expect(read("src/features/proposals/components/ProposalClientView.tsx")).toContain("proposal.exclusions");
        expect(read("src/app/(admin)/dashboard/proposals/[id]/page.tsx")).toContain("proposal.exclusions");
        expect(read("src/app/api/proposals/[id]/pdf/route.ts")).toContain("proposal.exclusions");
        expect(read("src/lib/pdf-generator.ts")).toContain("Not included");
    });
});
