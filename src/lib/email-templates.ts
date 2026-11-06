/**
 * Client-facing email content (inquiry received, meeting invite, meeting changed, proposal sent).
 *
 * Pure functions only: no database, no network, so they can be unit-tested. `src/lib/notifications.ts` sends
 * what these return. Rules for the copy: greet by first name, name the business and the service, say what
 * happens next, say who will be in touch when we know, and give ONE button. Plain, short, no emojis.
 *
 * All dates are shown in Asia/Manila time and say so, because the server may run in another timezone.
 */

export type MeetingFormat = "video" | "phone" | "in_person" | "on_site";
export type MeetingType = "discovery" | "budget_pricing" | "project_review" | "uat";

export type ClientEmail = { subject: string; html: string; text: string };

const MANILA = "Asia/Manila";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** "Maria Santos" becomes "Maria". Falls back to "there" so the greeting never reads "Hi ,". */
export function firstNameOf(fullName?: string | null): string {
    const first = (fullName ?? "").trim().split(/\s+/)[0];
    return first || "there";
}

/** App base URL for links in emails. */
export function getBaseUrl(): string {
    const fromEnv = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (fromEnv) return fromEnv.replace(/\/$/, "");
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    return "http://localhost:3000";
}

/** "Friday, November 6, 2026 at 10:00 AM (Manila time)" */
export function formatManilaDateTime(date: Date): string {
    const day = new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(date);
    const time = new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA,
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
    return `${day} at ${time} (Manila time)`;
}

/** "Fri, Nov 6, 10:00 AM", short enough for a subject line. */
export function formatManilaShort(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

/** "November 19, 2026" */
export function formatManilaDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA,
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

/** Matches the `meeting_format` enum. `on_site` and `in_person` stay different. */
export function meetingFormatLabel(format: MeetingFormat): string {
    switch (format) {
        case "video":
            return "Video call";
        case "phone":
            return "Phone call";
        case "in_person":
            return "In person";
        case "on_site":
            return "On site";
    }
}

export function meetingTypeLabel(type: MeetingType): string {
    switch (type) {
        case "discovery":
            return "discovery meeting";
        case "budget_pricing":
            return "budget and pricing meeting";
        case "project_review":
            return "project review meeting";
        case "uat":
            return "UAT and testing session";
    }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

type EmailParts = {
    subject: string;
    /** Plain text paragraphs. They are escaped here. */
    paragraphs: string[];
    /** Optional facts shown in a box. */
    details?: Array<[label: string, value: string]>;
    button: { label: string; url: string };
};

const FOOTER = "Optrizo Digital Solutions";

function renderEmail(parts: EmailParts): ClientEmail {
    const paragraphsHtml = parts.paragraphs
        .map((p) => `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.55; color: #14202b;">${escapeHtml(p)}</p>`)
        .join("");

    const detailsHtml = parts.details?.length
        ? `<div style="background: #f7f9fa; border: 1px solid #d3dce1; border-radius: 8px; padding: 16px; margin: 4px 0 24px;">${parts.details
              .map(
                  ([label, value]) =>
                      `<p style="margin: 0 0 8px; font-size: 14px; color: #14202b;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
              )
              .join("")}</div>`
        : "";

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #d3dce1; border-radius: 12px; background: #ffffff; color: #14202b;">
            ${paragraphsHtml}
            ${detailsHtml}
            <div style="margin: 8px 0 28px;">
                <a href="${escapeHtml(parts.button.url)}" style="background: #0e6b7e; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                    ${escapeHtml(parts.button.label)}
                </a>
            </div>
            <p style="font-size: 13px; color: #7a8b98; margin: 0;">${FOOTER}</p>
        </div>
    `;

    const text = [
        ...parts.paragraphs,
        ...(parts.details?.map(([label, value]) => `${label}: ${value}`) ?? []),
        `${parts.button.label}: ${parts.button.url}`,
        FOOTER,
    ].join("\n\n");

    return { subject: parts.subject, html, text };
}

// ---------------------------------------------------------------------------
// (a) Inquiry received
// ---------------------------------------------------------------------------

export function buildInquiryReceivedEmail(input: {
    clientName: string;
    businessName: string;
    serviceName: string;
    /** Public page of the service they asked about, when they picked one from the list. */
    serviceUrl?: string | null;
    /** Name of the Sales person, when one is already assigned. Usually unknown at this point. */
    contactName?: string | null;
    baseUrl?: string;
}): ClientEmail {
    const first = firstNameOf(input.clientName);
    const who = input.contactName ? `${input.contactName} from our sales team` : "Our sales team";
    const baseUrl = input.baseUrl ?? getBaseUrl();

    return renderEmail({
        subject: `${input.businessName}: we received your inquiry about ${input.serviceName}`,
        paragraphs: [
            `Hi ${first}, thank you for reaching out. We received your inquiry about ${input.serviceName} for ${input.businessName}.`,
            `${who} will contact you to set up a short meeting about your goals. After we meet, we prepare a proposal for you.`,
        ],
        button: input.serviceUrl
            ? { label: `View ${input.serviceName}`, url: input.serviceUrl }
            : { label: "Visit our website", url: baseUrl },
    });
}

// ---------------------------------------------------------------------------
// (b) Meeting invite and (c) meeting rescheduled or cancelled
// ---------------------------------------------------------------------------

type MeetingEmailBase = {
    clientName: string;
    businessName: string;
    /** Service the client asked about, when known. */
    serviceName?: string | null;
    meetingType: MeetingType;
    format: MeetingFormat;
    startsAt: Date;
    /** Person who runs the meeting, when known. */
    organizerName?: string | null;
    organizerRole?: "sales" | "manager";
    /** The lead is already linked to a portal account. */
    hasAccount: boolean;
    /** The client's email, used to prefill the sign-up page. */
    email: string;
    baseUrl?: string;
};

function organizerLine(name: string | null | undefined, role: "sales" | "manager" | undefined, verb: string): string {
    if (!name) return "";
    const team = role === "manager" ? "project management" : "sales";
    return ` ${name} from our ${team} team ${verb}.`;
}

function aboutPhrase(serviceName: string | null | undefined, businessName: string): string {
    return serviceName ? `${serviceName} for ${businessName}` : `the project for ${businessName}`;
}

/** Link for a client with no account yet: the sign-up form on /login, with the email prefilled. */
export function signupUrl(email: string, baseUrl: string = getBaseUrl()): string {
    const params = new URLSearchParams({ mode: "signup", email, callbackUrl: "/portal/appointments" });
    return `${baseUrl}/login?${params.toString()}`;
}

export function buildMeetingInviteEmail(input: MeetingEmailBase & { agenda?: string | null }): ClientEmail {
    const first = firstNameOf(input.clientName);
    const baseUrl = input.baseUrl ?? getBaseUrl();
    const type = meetingTypeLabel(input.meetingType);

    const paragraphs = [
        `Hi ${first}, we would like to meet to talk about ${aboutPhrase(input.serviceName, input.businessName)}. We set up a ${type} for ${formatManilaDateTime(input.startsAt)}.`,
        `Please confirm that this time works for you, or suggest another time.${organizerLine(input.organizerName, input.organizerRole, "will host it")}`,
    ];
    if (!input.hasAccount) {
        paragraphs.push("Create a portal account with this email address to confirm the meeting and see all your appointments.");
    }

    const details: Array<[string, string]> = [
        ["Date and time", formatManilaDateTime(input.startsAt)],
        ["Format", meetingFormatLabel(input.format)],
    ];
    if (input.agenda) details.push(["Agenda", input.agenda]);

    return renderEmail({
        subject: `${first}, your ${type} with Optrizo is on ${formatManilaShort(input.startsAt)}`,
        paragraphs,
        details,
        button: input.hasAccount
            ? { label: "Confirm or suggest a time", url: `${baseUrl}/portal/appointments` }
            : { label: "Create your account to confirm", url: signupUrl(input.email, baseUrl) },
    });
}

export function buildMeetingRescheduledEmail(input: MeetingEmailBase): ClientEmail {
    const first = firstNameOf(input.clientName);
    const baseUrl = input.baseUrl ?? getBaseUrl();
    const type = meetingTypeLabel(input.meetingType);

    const paragraphs = [
        `Hi ${first}, we moved your ${type} about ${aboutPhrase(input.serviceName, input.businessName)}. The new time is ${formatManilaDateTime(input.startsAt)}.`,
        `Please confirm the new time, or suggest another one.${organizerLine(input.organizerName, input.organizerRole, "will host it")}`,
    ];
    if (!input.hasAccount) {
        paragraphs.push("Create a portal account with this email address to confirm the meeting and see all your appointments.");
    }

    return renderEmail({
        subject: `${first}, your ${type} moved to ${formatManilaShort(input.startsAt)}`,
        paragraphs,
        details: [
            ["New date and time", formatManilaDateTime(input.startsAt)],
            ["Format", meetingFormatLabel(input.format)],
        ],
        button: input.hasAccount
            ? { label: "Confirm or suggest a time", url: `${baseUrl}/portal/appointments` }
            : { label: "Create your account to confirm", url: signupUrl(input.email, baseUrl) },
    });
}

export function buildMeetingCancelledEmail(input: MeetingEmailBase & { reason?: string | null }): ClientEmail {
    const first = firstNameOf(input.clientName);
    const baseUrl = input.baseUrl ?? getBaseUrl();
    const type = meetingTypeLabel(input.meetingType);
    const reason = input.reason?.trim();

    const who = input.organizerName
        ? `${input.organizerName} from our ${input.organizerRole === "manager" ? "project management" : "sales"} team`
        : "Our team";

    return renderEmail({
        subject: `${first}, your ${type} on ${formatManilaShort(input.startsAt)} was cancelled`,
        paragraphs: [
            `Hi ${first}, we cancelled your ${type} about ${aboutPhrase(input.serviceName, input.businessName)}, which was set for ${formatManilaDateTime(input.startsAt)}.${reason ? ` Reason: ${reason}.` : ""}`,
            `${who} will contact you to find a new time.`,
        ],
        button: input.hasAccount
            ? { label: "View your appointments", url: `${baseUrl}/portal/appointments` }
            : { label: "Contact us", url: `${baseUrl}/contact` },
    });
}

// ---------------------------------------------------------------------------
// (d) Proposal sent
// ---------------------------------------------------------------------------

export function buildProposalSentEmail(input: {
    clientName: string;
    businessName: string;
    projectName?: string | null;
    serviceName?: string | null;
    pmName?: string | null;
    version: number;
    validUntil?: Date | null;
    priceMode: "priced" | "to_be_discussed";
    proposalUrl: string;
}): ClientEmail {
    const first = firstNameOf(input.clientName);
    const project = input.projectName?.trim() || input.serviceName?.trim() || "your project";
    const who = input.pmName ? `${input.pmName} from our team` : "Our team";
    const revised = input.version > 1;

    const actions =
        input.priceMode === "to_be_discussed"
            ? "Please read it, then sign it online, ask for changes, or ask for a pricing meeting. The price follows after we talk about your budget."
            : "Please read it, then sign it online or ask for changes.";
    const valid = input.validUntil ? ` It stays open until ${formatManilaDate(input.validUntil)}.` : "";

    return renderEmail({
        subject: `${input.businessName}: your ${revised ? "revised " : ""}proposal for ${project} is ready`,
        paragraphs: [
            `Hi ${first}, ${who} prepared ${revised ? "a revised proposal (version " + input.version + ")" : "a proposal"} for ${project} for ${input.businessName}.${revised ? " It replaces the earlier version." : ""}`,
            `${actions}${valid}`,
        ],
        button: { label: "View your proposal", url: input.proposalUrl },
    });
}
