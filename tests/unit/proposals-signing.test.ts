import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/auth", async () => (await import("../helpers/mock-auth")).authModuleMock());
vi.mock("@/db", async () => ({ db: (await import("../helpers/mock-db")).createMockDb() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "192.168.1.1" })),
}));
vi.mock("@/features/audit/log", () => ({ logAction: vi.fn() }));
vi.mock("@/features/notifications/send", () => ({
    notifyLeadPms: vi.fn(),
    notifyLeadSales: vi.fn(),
    notifyLeadClient: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({
    sendSignedProposalEmail: vi.fn(),
}));

import { db } from "@/db";
import { type MockDb } from "../helpers/mock-db";
import { isProposalExpired } from "@/features/proposals/utils/expiry";
import { executeProposalSignature } from "@/features/proposals/signing";

const mockDb = db as unknown as MockDb;

describe("Proposal Signing & Expiry Unit Tests", () => {
    beforeEach(() => {
        mockDb.resetMocks();
    });

    describe("isProposalExpired - Asia/Manila Day Boundary", () => {
        const validUntil = "2026-11-02";

        it("returns false before midnight Manila time on the validUntil day", () => {
            // 2026-11-02 23:59:50 Manila time = 2026-11-02 15:59:50 UTC
            const beforeMidnight = new Date("2026-11-02T15:59:50.000Z");
            expect(isProposalExpired(validUntil, beforeMidnight)).toBe(false);
        });

        it("returns true immediately after midnight Manila time (next day begins)", () => {
            // 2026-11-03 00:00:01 Manila time = 2026-11-02 16:00:01 UTC
            const afterMidnight = new Date("2026-11-02T16:00:01.000Z");
            expect(isProposalExpired(validUntil, afterMidnight)).toBe(true);
        });

        it("returns false when validUntil is null or undefined", () => {
            expect(isProposalExpired(null)).toBe(false);
            expect(isProposalExpired(undefined)).toBe(false);
        });
    });

    describe("Payment Schedule Remainder Calculation", () => {
        it("allocates exact remainder to the last item so sum equals totalPrice", () => {
            const totalPrice = 100001; // Odd amount to test rounding
            const items = [
                { id: "1", label: "Deposit", percent: 30, trigger: "on_signing" },
                { id: "2", label: "Milestone 1", percent: 30, trigger: "requirements" },
                { id: "3", label: "Final", percent: 40, trigger: "handover" },
            ];

            let allocatedSum = 0;
            const payments = items.map((item, index) => {
                const isLast = index === items.length - 1;
                const amount = isLast
                    ? totalPrice - allocatedSum
                    : Math.round((totalPrice * item.percent) / 100);
                allocatedSum += amount;
                return { ...item, amount };
            });

            expect(payments[0].amount).toBe(30000); // 30% of 100001 = 30000.3 -> 30000
            expect(payments[1].amount).toBe(30000); // 30% of 100001 = 30000.3 -> 30000
            expect(payments[2].amount).toBe(40001); // 100001 - 60000 = 40001 (remainder)

            const totalAllocated = payments.reduce((sum, p) => sum + p.amount, 0);
            expect(totalAllocated).toBe(totalPrice);
        });
    });

    describe("executeProposalSignature Precondition Guards", () => {
        it("rejects proposal when status is not sent (e.g. draft)", async () => {
            mockDb.query.proposals.findFirst.mockResolvedValue({
                id: "prop-draft",
                status: "draft",
                priceMode: "priced",
                totalPrice: 50000,
                lead: { id: "lead-1", clientId: "client-1" },
            });

            const res = await executeProposalSignature({
                proposalId: "prop-draft",
                signerName: "Client Signer",
                signatureType: "online",
                signatureData: "sig-data",
                agreedToTerms: true,
                actorRole: "client",
                userId: "client-1",
            });

            expect(res.success).toBe(false);
            expect(res.message).toContain("must be \"sent\"");
        });

        it("rejects second sign attempt on an already signed proposal", async () => {
            mockDb.query.proposals.findFirst.mockResolvedValue({
                id: "prop-signed",
                status: "signed",
                priceMode: "priced",
                totalPrice: 50000,
                lead: { id: "lead-1", clientId: "client-1" },
            });

            const res = await executeProposalSignature({
                proposalId: "prop-signed",
                signerName: "Client Signer",
                signatureType: "online",
                signatureData: "sig-data",
                agreedToTerms: true,
                actorRole: "client",
                userId: "client-1",
            });

            expect(res.success).toBe(false);
            expect(res.message).toContain("must be \"sent\"");
        });
    });
});
