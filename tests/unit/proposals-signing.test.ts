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
import { auth } from "@/auth";
import { signInAs } from "../helpers/mock-auth";
import { type MockDb } from "../helpers/mock-db";
import { isProposalExpired } from "@/features/proposals/utils/expiry";
import { executeProposalSignature } from "@/features/proposals/signing-core";
import { provisionProjectFromProposal } from "@/features/crm/provisionLeadProject";
import * as signingModule from "@/features/proposals/signing";
import { requestProposalChanges } from "@/features/proposals/signing";

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

    describe("Payment Schedule Remainder Calculation & Sorting", () => {
        it("allocates exact remainder to the last item after sorting by sortOrder", async () => {
            const totalPrice = 100001; // Odd amount where 30% produces .3 fraction

            // Intentionally provide items out of order: sortOrder 2 first, then 0, then 1
            const unsortedScheduleItems = [
                { id: "item-last", label: "Final Handover", sortOrder: 2, percent: 40, trigger: "handover" as const },
                { id: "item-first", label: "Initial Deposit", sortOrder: 0, percent: 30, trigger: "on_signing" as const },
                { id: "item-mid", label: "Milestone Beta", sortOrder: 1, percent: 30, trigger: "development" as const },
            ];

            mockDb.query.leads.findFirst.mockResolvedValue({
                id: "lead-1",
                businessName: "Acme Corp",
                clientId: "client-1",
                client: { id: "client-1", role: "client", email: "client@acme.com" },
            });
            mockDb.query.agencyProjects.findFirst.mockResolvedValue(null);

            // Mock returned values for inserts
            mockDb.setWriteRows([{ id: "proj-1", title: "Acme Corp Project" }]);

            const proposal = {
                id: "prop-1",
                leadId: "lead-1",
                priceMode: "priced" as const,
                totalPrice,
                currency: "PHP" as const,
                paymentScheduleItems: unsortedScheduleItems,
            };

            const result = await provisionProjectFromProposal(mockDb, proposal);

            expect(result.payments).toHaveLength(3);
            // After sort by sortOrder (0, 1, 2):
            // 0: item-first (30% of 100001 = 30000)
            expect(result.payments[0].label).toBe("Initial Deposit");
            expect(result.payments[0].amount).toBe(30000);
            expect(result.payments[0].status).toBe("due");

            // 1: item-mid (30% of 100001 = 30000)
            expect(result.payments[1].label).toBe("Milestone Beta");
            expect(result.payments[1].amount).toBe(30000);
            expect(result.payments[1].status).toBe("not_yet_due");

            // 2: item-last (40% + remainder = 100001 - 60000 = 40001)
            expect(result.payments[2].label).toBe("Final Handover");
            expect(result.payments[2].amount).toBe(40001);
            expect(result.payments[2].status).toBe("not_yet_due");

            // Verify sum of amounts strictly matches totalPrice
            const sum = result.payments.reduce((acc, p) => acc + p.amount, 0);
            expect(sum).toBe(totalPrice);
        });

        it("throws when priced proposal has no payment schedule items", async () => {
            mockDb.query.leads.findFirst.mockResolvedValue({
                id: "lead-1",
                clientId: "client-1",
            });
            mockDb.query.agencyProjects.findFirst.mockResolvedValue(null);

            const proposal = {
                id: "prop-empty-schedule",
                leadId: "lead-1",
                priceMode: "priced" as const,
                totalPrice: 50000,
                paymentScheduleItems: [],
            };

            await expect(provisionProjectFromProposal(mockDb, proposal)).rejects.toThrow(
                /has no payment schedule items/
            );
        });

        it("throws when payment schedule item percentages do not sum to 100%", async () => {
            mockDb.query.leads.findFirst.mockResolvedValue({
                id: "lead-1",
                clientId: "client-1",
            });
            mockDb.query.agencyProjects.findFirst.mockResolvedValue(null);

            const proposal = {
                id: "prop-bad-sum",
                leadId: "lead-1",
                priceMode: "priced" as const,
                totalPrice: 50000,
                paymentScheduleItems: [
                    { id: "1", label: "Deposit", percent: 50, sortOrder: 0, trigger: "on_signing" as const },
                    { id: "2", label: "Final", percent: 40, sortOrder: 1, trigger: "handover" as const },
                ], // Totals 90%
            };

            await expect(provisionProjectFromProposal(mockDb, proposal)).rejects.toThrow(
                /must total 100%, got 90%/
            );
        });
    });

    describe("executeProposalSignature Precondition Guards & Transaction Isolation", () => {
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

        it("rejects initial check if proposal is already signed", async () => {
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

        it("rejects second sign when locked row inside transaction is no longer sent", async () => {
            // Initial read sees proposal in status 'sent', followed by higherVersion checks returning null
            mockDb.query.proposals.findFirst
                .mockResolvedValueOnce({
                    id: "prop-race",
                    status: "sent",
                    priceMode: "priced",
                    totalPrice: 50000,
                    version: 1,
                    validUntil: null,
                    lead: { id: "lead-1", clientId: "client-1", client: { email: "client@acme.com" } },
                })
                .mockResolvedValueOnce(null) // pre-flight higherVersion check
                .mockResolvedValueOnce(null); // inside tx higherVersionTx check

            // But inside the transaction, the locked row read (.select().from(proposals)...for("update"))
            // returns a row that was already marked 'signed' by a concurrent request
            mockDb.setSelectRows([
                {
                    id: "prop-race",
                    status: "signed",
                    priceMode: "priced",
                    totalPrice: 50000,
                    version: 1,
                    validUntil: null,
                },
            ]);

            const res = await executeProposalSignature({
                proposalId: "prop-race",
                signerName: "Concurrent Client Signer",
                signatureType: "online",
                signatureData: "sig-data",
                agreedToTerms: true,
                actorRole: "client",
                userId: "client-1",
            });

            expect(res.success).toBe(false);
            expect(res.message).toContain("Only \"sent\" proposals can be signed");
        });

        it("rejects client signature when userEmail is null or empty to prevent null===null matches", async () => {
            mockDb.query.proposals.findFirst.mockResolvedValue({
                id: "prop-null-email",
                status: "sent",
                priceMode: "priced",
                totalPrice: 50000,
                lead: {
                    id: "lead-1",
                    clientId: "other-user",
                    client: { email: null },
                    contactEmail: null,
                },
            });

            const res = await executeProposalSignature({
                proposalId: "prop-null-email",
                signerName: "Attacker",
                signatureType: "online",
                signatureData: "sig-data",
                agreedToTerms: true,
                actorRole: "client",
                userId: "attacker-user-id",
                userEmail: null, // Should not match client.email: null
            });

            expect(res.success).toBe(false);
            expect(res.message).toContain("Forbidden");
        });
    });

    describe("Signature image check", () => {
        it("accepts typed names and small PNG/JPEG/WebP data URLs, rejects other types and oversized images", async () => {
            const { signatureImageError, SIGNATURE_IMAGE_MAX_CHARS } = await import("@/features/proposals/signing-core");
            expect(signatureImageError("Juan Dela Cruz")).toBeNull();
            expect(signatureImageError("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
            expect(signatureImageError("data:image/jpeg;base64,/9j/4AAQ")).toBeNull();
            expect(signatureImageError("data:image/svg+xml;base64,PHN2Zz4=")).toMatch(/PNG, JPG or WebP/);
            expect(signatureImageError("data:text/html;base64,PGI+")).toMatch(/PNG, JPG or WebP/);
            expect(signatureImageError("data:image/png;base64," + "A".repeat(SIGNATURE_IMAGE_MAX_CHARS))).toMatch(/too large/);
        });
    });

    describe("Proposal Messages & Negotiation Hardening", () => {
        it("ensures getProposalMessages is not exposed as an uncalled server action (function is gone)", () => {
            expect((signingModule as Record<string, unknown>).getProposalMessages).toBeUndefined();
        });

        it("requestProposalChanges drops unknown topics and retains only allowed topics", async () => {
            signInAs(auth, "client", "client-1");

            // Mock proposal and lead returned during tx.select()...for("update")
            mockDb.setSelectRows([
                {
                    id: "prop-1",
                    leadId: "lead-1",
                    status: "sent",
                    proposalCode: "OPT-001",
                    clientId: "client-1",
                },
            ]);

            mockDb.query.leads.findFirst.mockResolvedValue({
                id: "lead-1",
                status: "Proposal Sent",
            });

            // Capture inserted values for proposalMessages
            let insertedMessage: Record<string, unknown> | null = null;
            const origInsert = mockDb.insert;
            mockDb.insert = vi.fn((table: unknown) => {
                const proxy = origInsert(table);
                return new Proxy(proxy, {
                    get(target, prop) {
                        if (prop === "values") {
                            return (vals: Record<string, unknown>) => {
                                if (!insertedMessage && vals?.kind === "change_request") {
                                    insertedMessage = vals;
                                }
                                return typeof target.values === "function" ? target.values(vals) : target;
                            };
                        }
                        return Reflect.get(target, prop);
                    },
                });
            }) as unknown as typeof mockDb.insert;

            const res = await requestProposalChanges(
                "prop-1",
                ["price", "unauthorized_topic", "timeline", "hacked_scope", "scope"],
                "Please adjust budget and milestone schedule"
            );

            expect(res.success).toBe(true);
            const msg = insertedMessage as Record<string, unknown> | null;
            expect(msg).not.toBeNull();
            expect(msg?.topics).toEqual(["price", "timeline", "scope"]);
            expect(msg?.topics).not.toContain("unauthorized_topic");
            expect(msg?.topics).not.toContain("hacked_scope");
        });

        it("requestProposalChanges rejects if all topics are unknown and body is empty", async () => {
            signInAs(auth, "client", "client-1");

            const res = await requestProposalChanges(
                "prop-1",
                ["unknown_topic_only", "fake_topic"],
                "   "
            );

            expect(res.success).toBe(false);
            expect(res.message).toContain("Please select at least one topic");
        });
    });
});
