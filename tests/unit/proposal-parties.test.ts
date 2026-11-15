import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { proposalParties } from "@/features/proposals/parties";
import { generateSOWHtml } from "@/lib/pdf-generator";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

const lead = {
    contactName: "Maria Santos",
    contactEmail: "maria@santos.ph",
    contactPhone: "+63 917 000 1111",
    roleInCompany: "Operations Head",
    industry: "Logistics",
    otherServiceText: "Custom thing",
    client: { name: "Account Name", email: "account@santos.ph" },
    service: { title: "Web application" },
    assignedPm: { name: "Ana Reyes", email: "ana@optrizo.com" },
};

describe("proposalParties", () => {
    it("collects the client, PM, service and industry details from the lead", () => {
        expect(proposalParties(lead)).toEqual({
            clientName: "Maria Santos",
            clientRole: "Operations Head",
            clientEmail: "maria@santos.ph",
            clientPhone: "+63 917 000 1111",
            serviceName: "Web application",
            industry: "Logistics",
            pmName: "Ana Reyes",
            pmEmail: "ana@optrizo.com",
        });
    });

    it("lets what the PM typed in contract settings win over the lead", () => {
        const p = proposalParties(lead, { clientContactPerson: "Jose Santos", clientPhone: "02 8000 0000" });
        expect(p.clientName).toBe("Jose Santos");
        expect(p.clientPhone).toBe("02 8000 0000");
    });

    it("falls back to the account, then to the other service text", () => {
        const p = proposalParties({ client: lead.client, otherServiceText: "Custom thing" });
        expect(p).toMatchObject({ clientName: "Account Name", clientEmail: "account@santos.ph", serviceName: "Custom thing" });
    });

    it("turns blanks and a missing lead into null, never an empty string", () => {
        const blank = proposalParties({ contactName: "  ", roleInCompany: "", assignedPm: { name: null, email: null } });
        expect(Object.values(blank).every((v) => v === null)).toBe(true);
        expect(Object.values(proposalParties(null)).every((v) => v === null)).toBe(true);
    });
});

const sow = (extra: Record<string, unknown>) =>
    generateSOWHtml({
        proposalCode: "OPT-1", businessName: "Santos Logistics", deliverables: [], pricingItems: [],
        subtotal: 0, discount: 0, tax: 0, total: 0, status: "sent", ...extra,
    });

describe("proposal PDF parties", () => {
    it("prints the client name and role, phone, PM, service and industry", () => {
        const html = sow({ parties: proposalParties(lead) });
        expect(html).toContain("Attn: Maria Santos, Operations Head");
        expect(html).toContain("maria@santos.ph");
        expect(html).toContain("Phone: +63 917 000 1111");
        expect(html).toContain("Project Manager: Ana Reyes");
        expect(html).toContain("Service: Web application");
        expect(html).toContain("Industry: Logistics");
    });

    it("escapes what a client typed", () => {
        const html = sow({ parties: proposalParties({ ...lead, contactName: "<script>alert(1)</script>" }) });
        expect(html).not.toContain("<script>alert(1)</script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("leaves the lines out when the lead has none of those details", () => {
        const html = sow({ parties: proposalParties({}) });
        expect(html).not.toContain("Attn:");
        expect(html).not.toContain("Industry:");
        expect(html).not.toContain("Project Manager:");
    });
});

describe("proposal document wiring", () => {
    it("shows the details in the sheet and feeds them from every caller", () => {
        const sheet = read("src/features/proposals/components/ProposalDocumentSheet.tsx");
        expect(sheet).toContain("parties.clientName");
        expect(sheet).toContain("parties.pmName");
        for (const file of [
            "src/app/(admin)/dashboard/proposals/[id]/page.tsx",
            "src/app/(admin)/dashboard/proposals/builder/[id]/page.tsx",
            "src/features/proposals/components/ProposalClientView.tsx",
            "src/app/api/proposals/[id]/pdf/route.ts",
        ]) {
            expect(read(file), file).toContain("proposalParties(");
        }
    });

    it("sends the client page only the client's name and email, not the whole user row", () => {
        expect(read("src/app/(client)/proposal/[id]/page.tsx")).toContain("client: { columns: { id: true, name: true, email: true } }");
    });
});
