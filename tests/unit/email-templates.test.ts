import { describe, it, expect, vi } from "vitest";
import {
    buildInquiryReceivedEmail,
    buildMeetingCancelledEmail,
    buildMeetingInviteEmail,
    buildMeetingRescheduledEmail,
    buildProposalSentEmail,
    escapeHtml,
    firstNameOf,
    formatManilaDate,
    getBaseUrl,
    formatManilaDateTime,
    formatManilaShort,
    meetingFormatLabel,
    meetingTypeLabel,
    signupUrl,
    type MeetingFormat,
} from "@/lib/email-templates";
import { servicePageHref } from "@/lib/service-links";

const BASE = "https://optrizo.example";
// Nov 6, 2026, 10:00 AM in Manila (02:00 UTC). A server in UTC would say 2:00 AM.
const MEETING_AT = new Date("2026-11-06T02:00:00.000Z");

const baseMeeting = {
    clientName: "Maria Santos",
    businessName: "Santos Logistics",
    serviceName: "Mobile App",
    meetingType: "discovery" as const,
    format: "video" as const,
    startsAt: MEETING_AT,
    organizerName: "Ana Reyes",
    organizerRole: "sales" as const,
    hasAccount: false,
    email: "maria@santos.example",
    baseUrl: BASE,
};

const buttons = (html: string) => html.match(/<a /g)?.length ?? 0;

describe("small helpers", () => {
    it("firstNameOf takes the first word and never returns an empty greeting", () => {
        expect(firstNameOf("Maria Santos")).toBe("Maria");
        expect(firstNameOf("  Juan   dela Cruz ")).toBe("Juan");
        expect(firstNameOf("")).toBe("there");
        expect(firstNameOf(null)).toBe("there");
        expect(firstNameOf(undefined)).toBe("there");
    });

    it("escapeHtml escapes markup", () => {
        expect(escapeHtml(`<b onclick="x">Tom & 'Jerry'</b>`)).toBe(
            "&lt;b onclick=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;",
        );
    });
});

describe("Manila date formatting", () => {
    it("shows Manila time, not the server timezone", () => {
        expect(formatManilaDateTime(MEETING_AT)).toMatch(/^Nov 6, 2026, 10:00\sAM \(Manila time\)$/);
        expect(formatManilaShort(MEETING_AT)).toMatch(/^Nov 6, 2026, 10:00\sAM$/);
        expect(formatManilaDate(MEETING_AT)).toBe("Nov 6, 2026");
    });

    it("moves to the next calendar day when UTC is still the day before", () => {
        const lateUtc = new Date("2026-11-06T17:00:00.000Z"); // Nov 7, 1:00 AM in Manila
        expect(formatManilaDateTime(lateUtc)).toMatch(/Nov 7, 2026, 1:00\sAM \(Manila time\)/);
        expect(formatManilaDate(lateUtc)).toBe("Nov 7, 2026");
    });
});

describe("meeting wording follows the meeting_format and meeting_type enums", () => {
    it("keeps in_person and on_site different", () => {
        const labels = (["video", "phone", "in_person", "on_site"] as MeetingFormat[]).map(meetingFormatLabel);
        expect(labels).toEqual(["Video call", "Phone call", "In person", "On site"]);
        expect(new Set(labels).size).toBe(4);
    });

    it("names every meeting type", () => {
        expect(meetingTypeLabel("discovery")).toBe("discovery meeting");
        expect(meetingTypeLabel("budget_pricing")).toBe("budget and pricing meeting");
        expect(meetingTypeLabel("project_review")).toBe("project review meeting");
        expect(meetingTypeLabel("uat")).toBe("UAT and testing session");
    });
});

describe("inquiry received email", () => {
    const email = buildInquiryReceivedEmail({
        clientName: "Maria Santos",
        businessName: "Santos Logistics",
        serviceName: "Mobile App",
        baseUrl: BASE,
    });

    it("greets by first name and names the business and the service", () => {
        expect(email.subject).toBe("Santos Logistics: we received your inquiry about Mobile App");
        expect(email.text).toContain("Hi Maria, thank you for reaching out. We received your inquiry about Mobile App for Santos Logistics.");
        expect(email.html).toContain("Hi Maria,");
    });

    it("says what happens next and who will be in touch", () => {
        expect(email.text).toContain("Our sales team will contact you to set up a short meeting");
        const named = buildInquiryReceivedEmail({
            clientName: "Maria",
            businessName: "Santos Logistics",
            serviceName: "Mobile App",
            contactName: "Ana Reyes",
        });
        expect(named.text).toContain("Ana Reyes from our sales team will contact you");
    });

    it("has one button to the client portal home", () => {
        expect(buttons(email.html)).toBe(1);
        expect(email.html).toContain(`href="${BASE}/portal"`);
        expect(email.html).toContain("View your availed service");
    });

    it("escapes what the visitor typed", () => {
        const evil = buildInquiryReceivedEmail({
            clientName: "<script>alert(1)</script>",
            businessName: "A & B <img src=x>",
            serviceName: "Other",
            baseUrl: BASE,
        });
        expect(evil.html).not.toContain("<script>");
        expect(evil.html).not.toContain("<img src=x>");
        expect(evil.html).toContain("A &amp; B &lt;img src=x&gt;");
    });
});

describe("meeting invite email", () => {
    it("greets, names the business and service, gives the Manila time and who hosts", () => {
        const email = buildMeetingInviteEmail({ ...baseMeeting, agenda: "Learn your goals" });
        expect(email.subject).toMatch(/^Maria, your discovery meeting with Optrizo is on Nov 6, 2026, 10:00\sAM$/);
        expect(email.text).toContain("Hi Maria, we would like to meet to talk about Mobile App for Santos Logistics.");
        expect(email.text).toMatch(/Nov 6, 2026, 10:00\sAM \(Manila time\)/);
        expect(email.text).toContain("Ana Reyes from our sales team will host it.");
        expect(email.text).toContain("Format: Video call");
        expect(email.text).toContain("Agenda: Learn your goals");
    });

    it("sends a client with no account to the sign-up form, with their email prefilled", () => {
        const email = buildMeetingInviteEmail(baseMeeting);
        expect(buttons(email.html)).toBe(1);
        expect(email.html).toContain("Create your account to confirm");
        const href = email.html.match(/href="([^"]+)"/)?.[1] ?? "";
        const url = new URL(href.replace(/&amp;/g, "&"));
        expect(url.origin + url.pathname).toBe(`${BASE}/login`);
        expect(url.searchParams.get("mode")).toBe("signup");
        expect(url.searchParams.get("email")).toBe("maria@santos.example");
        expect(email.text).toContain("Create a portal account with this email address");
    });

    it("sends a client with an account to the appointments page", () => {
        const email = buildMeetingInviteEmail({ ...baseMeeting, hasAccount: true });
        expect(buttons(email.html)).toBe(1);
        expect(email.html).toContain(`href="${BASE}/portal/appointments"`);
        expect(email.html).toContain("Confirm or suggest a time");
        expect(email.text).not.toContain("Create a portal account");
    });

    it("keeps on site and in person apart", () => {
        expect(buildMeetingInviteEmail({ ...baseMeeting, format: "on_site" }).text).toContain("Format: On site");
        expect(buildMeetingInviteEmail({ ...baseMeeting, format: "in_person" }).text).toContain("Format: In person");
    });

    it("works without a service or an organizer", () => {
        const email = buildMeetingInviteEmail({ ...baseMeeting, serviceName: null, organizerName: null, clientName: "" });
        expect(email.text).toContain("Hi there, we would like to meet to talk about the project for Santos Logistics.");
        expect(email.text).not.toContain("will host it");
    });

    it("uses the PM team wording for a PM meeting", () => {
        const email = buildMeetingInviteEmail({ ...baseMeeting, meetingType: "budget_pricing", organizerRole: "manager" });
        expect(email.subject).toContain("budget and pricing meeting");
        expect(email.text).toContain("Ana Reyes from our project management team will host it.");
    });

    it("signupUrl builds the sign-up link", () => {
        expect(signupUrl("a+b@x.example", BASE)).toBe(
            `${BASE}/login?mode=signup&email=a%2Bb%40x.example&callbackUrl=%2Fportal%2Fappointments`,
        );
    });
});

describe("meeting rescheduled and cancelled emails", () => {
    it("rescheduled: gives the new Manila time and asks to confirm", () => {
        const email = buildMeetingRescheduledEmail({ ...baseMeeting, hasAccount: true });
        expect(email.subject).toMatch(/^Maria, your discovery meeting moved to Nov 6, 2026, 10:00\sAM$/);
        expect(email.text).toContain("we moved your discovery meeting about Mobile App for Santos Logistics");
        expect(email.text).toMatch(/The new time is Nov 6, 2026, 10:00\sAM \(Manila time\)/);
        expect(buttons(email.html)).toBe(1);
        expect(email.html).toContain("Confirm or suggest a time");
    });

    it("cancelled: says what was cancelled, the reason, and who will follow up", () => {
        const email = buildMeetingCancelledEmail({ ...baseMeeting, hasAccount: true, reason: "We need to move the kickoff" });
        expect(email.subject).toMatch(/^Maria, your discovery meeting on Nov 6, 2026, 10:00\sAM was cancelled$/);
        expect(email.text).toContain("we cancelled your discovery meeting about Mobile App for Santos Logistics");
        expect(email.text).toContain("Reason: We need to move the kickoff.");
        expect(email.text).toContain("Ana Reyes from our sales team will contact you to find a new time.");
        expect(buttons(email.html)).toBe(1);
        expect(email.html).toContain(`href="${BASE}/portal/appointments"`);
    });

    it("cancelled: a client with no account gets a contact button and no empty reason", () => {
        const email = buildMeetingCancelledEmail({ ...baseMeeting, reason: "  " });
        expect(email.text).not.toContain("Reason:");
        expect(email.html).toContain(`href="${BASE}/contact"`);
        expect(buttons(email.html)).toBe(1);
    });
});

describe("proposal sent email", () => {
    const base = {
        clientName: "Maria Santos",
        businessName: "Santos Logistics",
        projectName: "Delivery Tracking App",
        pmName: "Joy Villanueva",
        version: 1,
        validUntil: new Date("2026-11-19T04:00:00.000Z"),
        priceMode: "to_be_discussed" as const,
        proposalUrl: `${BASE}/proposal/p-1`,
    };

    it("names the person, the business, the project and the PM", () => {
        const email = buildProposalSentEmail(base);
        expect(email.subject).toBe("Santos Logistics: your proposal for Delivery Tracking App is ready");
        expect(email.text).toContain("Hi Maria, Joy Villanueva from our team prepared a proposal for Delivery Tracking App for Santos Logistics.");
    });

    it("says what to do next, when it stays open, and has one button", () => {
        const email = buildProposalSentEmail(base);
        expect(email.text).toContain("sign it online, ask for changes, or ask for a pricing meeting");
        expect(email.text).toContain("The price follows after we talk about your budget.");
        expect(email.text).toContain("It stays open until Nov 19, 2026.");
        expect(buttons(email.html)).toBe(1);
        expect(email.html).toContain(`href="${BASE}/proposal/p-1"`);
        expect(email.html).toContain("View your proposal");
    });

    it("a priced proposal does not mention the pricing meeting", () => {
        const email = buildProposalSentEmail({ ...base, priceMode: "priced" });
        expect(email.text).not.toContain("pricing meeting");
    });

    it("a revised proposal says so", () => {
        const email = buildProposalSentEmail({ ...base, version: 2 });
        expect(email.subject).toContain("your revised proposal for Delivery Tracking App");
        expect(email.text).toContain("a revised proposal (version 2)");
        expect(email.text).toContain("It replaces the earlier version.");
    });

    it("falls back when the project name or PM is unknown", () => {
        const email = buildProposalSentEmail({ ...base, projectName: null, serviceName: "Mobile App", pmName: null });
        expect(email.subject).toContain("proposal for Mobile App");
        expect(email.text).toContain("Our team prepared a proposal");
    });
});

describe("copy rules", () => {
    const all = [
        buildInquiryReceivedEmail({ clientName: "Maria", businessName: "B", serviceName: "S", baseUrl: BASE }),
        buildMeetingInviteEmail(baseMeeting),
        buildMeetingRescheduledEmail(baseMeeting),
        buildMeetingCancelledEmail({ ...baseMeeting, reason: "x" }),
        buildProposalSentEmail({
            clientName: "Maria",
            businessName: "B",
            version: 2,
            priceMode: "priced",
            proposalUrl: `${BASE}/proposal/p-1`,
            validUntil: new Date(),
        }),
    ];

    it.each(all.map((email, i) => [i, email] as const))("email %i has no em dashes and no emojis", (_i, email) => {
        const content = `${email.subject}\n${email.text}`;
        expect(content).not.toContain("—");
        expect(content).not.toMatch(/\p{Extended_Pictographic}/u);
    });
});

describe("servicePageHref", () => {
    it("links to the public service page by slug", () => {
        expect(servicePageHref("web-development")).toBe("/services/web-development");
        expect(servicePageHref("  mobile-app ")).toBe("/services/mobile-app");
    });

    it("encodes unusual slugs", () => {
        expect(servicePageHref("ui ux/design")).toBe("/services/ui%20ux%2Fdesign");
    });

    it("returns null when there is no slug, so the thank-you button is hidden", () => {
        expect(servicePageHref(null)).toBeNull();
        expect(servicePageHref(undefined)).toBeNull();
        expect(servicePageHref("")).toBeNull();
        expect(servicePageHref("   ")).toBeNull();
    });

    it("is what the thank-you modal uses for the inquiry result", () => {
        const withService = { serviceName: "Mobile App", serviceSlug: "mobile-app" };
        const other = { serviceName: "Other", serviceSlug: null };
        expect(servicePageHref(withService.serviceSlug)).toBe("/services/mobile-app");
        expect(servicePageHref(other.serviceSlug)).toBeNull();
    });
});

describe("meeting email for a client in another timezone", () => {
    it("gives their time and Manila time", () => {
        const email = buildMeetingInviteEmail({ ...baseMeeting, timezone: "Asia/Dubai" });
        expect(email.text).toMatch(/6:00\sAM GMT\+4 \(Nov 6, 2026, 10:00\sAM Manila time\)/);
    });
});

describe("getBaseUrl", () => {
    const keys = ["NEXTAUTH_URL", "AUTH_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    const restore = () => keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));

    it("reads any of the app URL settings and drops a trailing slash", () => {
        keys.forEach((k) => delete process.env[k]);
        process.env.NEXT_PUBLIC_APP_URL = "https://optrizo.com/";
        expect(getBaseUrl()).toBe("https://optrizo.com");
        process.env.NEXTAUTH_URL = "https://crm.optrizo.com";
        expect(getBaseUrl()).toBe("https://crm.optrizo.com");
        restore();
    });

    it("never falls back to localhost in production", () => {
        keys.forEach((k) => delete process.env[k]);
        vi.stubEnv("NODE_ENV", "production");
        expect(getBaseUrl()).toBe("https://optrizo.com");
        vi.unstubAllEnvs();
        restore();
    });
});
