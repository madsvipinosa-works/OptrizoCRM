import type { ContractSettings } from "@/features/proposals/actions";

/** The lead fields a proposal document draws its client and PM details from. */
export interface PartiesLead {
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    roleInCompany?: string | null;
    industry?: string | null;
    otherServiceText?: string | null;
    client?: { name?: string | null; email?: string | null } | null;
    service?: { title?: string | null } | null;
    assignedPm?: { name?: string | null; email?: string | null } | null;
}

export interface ProposalParties {
    clientName: string | null;
    clientRole: string | null;
    clientEmail: string | null;
    clientPhone: string | null;
    serviceName: string | null;
    industry: string | null;
    pmName: string | null;
    pmEmail: string | null;
}

const clean = (value?: string | null) => value?.trim() || null;
const first = (...values: Array<string | null | undefined>) => values.map(clean).find(Boolean) ?? null;

/**
 * Who the proposal is for and who prepared it, in one place so the PM preview, the client view,
 * the PM's document tab and the PDF all show the same lines. What the PM typed into the contract
 * settings (contact person, phone) wins over the lead's own values; blanks become null.
 */
export function proposalParties(lead: PartiesLead | null | undefined, contract?: ContractSettings | null): ProposalParties {
    return {
        clientName: first(contract?.clientContactPerson, lead?.contactName, lead?.client?.name),
        clientRole: clean(lead?.roleInCompany),
        clientEmail: first(lead?.contactEmail, lead?.client?.email),
        clientPhone: first(contract?.clientPhone, lead?.contactPhone),
        serviceName: first(lead?.service?.title, lead?.otherServiceText),
        industry: clean(lead?.industry),
        pmName: clean(lead?.assignedPm?.name),
        pmEmail: clean(lead?.assignedPm?.email),
    };
}
