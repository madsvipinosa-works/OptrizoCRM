import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/schema";

/** Names used to make proposal notifications specific: who, which business, which project. */
export type ProposalNoticeInfo = {
    /** The client's contact person, or the business name when there is no contact name. */
    clientName: string;
    businessName: string;
    /** Project name, falling back to the service they asked about, then a generic label. */
    projectName: string;
    version: number;
    priceMode: "priced" | "to_be_discussed";
    /** The lead's Project Manager, when one is assigned. */
    pmName: string | null;
};

export async function loadProposalNoticeInfo(proposalId: string): Promise<ProposalNoticeInfo> {
    const proposal = await db.query.proposals.findFirst({
        where: eq(proposals.id, proposalId),
        with: { lead: { with: { service: true, assignedPm: true } } },
    });

    const lead = proposal?.lead;
    const businessName = lead?.businessName || lead?.contactName || "the client";
    return {
        clientName: lead?.contactName || businessName,
        businessName,
        projectName: proposal?.projectName?.trim() || lead?.service?.title || lead?.otherServiceText || "the project",
        version: proposal?.version ?? 1,
        priceMode: proposal?.priceMode ?? "to_be_discussed",
        pmName: lead?.assignedPm?.name || null,
    };
}
