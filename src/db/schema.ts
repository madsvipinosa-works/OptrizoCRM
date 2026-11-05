import {
    boolean,
    timestamp,
    date,
    pgTable,
    text,
    primaryKey,
    integer,
    pgEnum,
    foreignKey,
    index,
    uniqueIndex,
    jsonb,
    check
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccount } from "next-auth/adapters";

// 1. Enums (Single Source of Truth)
export const roleEnum = pgEnum("role", ["superadmin", "sales", "manager", "developer", "content_editor", "client"]);
export const paymentMethodEnum = pgEnum("payment_method", ["bank_transfer", "gcash", "cheque", "cash"]);
export const accountStatusEnum = pgEnum("account_status", ["invited", "active", "locked", "deactivated"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "published", "hidden"]);

// 2. Users Table (Extended for RBAC)
export const users = pgTable("user", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    password: text("password"),
    image: text("image"),
    role: roleEnum("role").default("client").notNull(),
    status: accountStatusEnum("status").default("active").notNull(),
    failedLogins: integer("failed_logins").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    jobTitle: text("job_title"),
    companyName: text("company_name"),
    industry: text("industry"),
    linkedInUrl: text("linkedin_url"),
    isActive: boolean("is_active").default(true).notNull(),
    showOnAboutPage: boolean("show_on_about_page").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
});

// 3. Accounts (For Google/GitHub OAuth)
export const accounts = pgTable(
    "account",
    {
        userId: text("userId")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        type: text("type").$type<AdapterAccount["type"]>().notNull(),
        provider: text("provider").notNull(),
        providerAccountId: text("providerAccountId").notNull(),
        refresh_token: text("refresh_token"),
        access_token: text("access_token"),
        expires_at: integer("expires_at"),
        token_type: text("token_type"),
        scope: text("scope"),
        id_token: text("id_token"),
        session_state: text("session_state"),
    },
    (account) => [
        primaryKey({
            columns: [account.provider, account.providerAccountId],
        }),
    ]
);

// 4. Sessions (Database Strategy)
export const sessions = pgTable("session", {
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
});

// 5. Verification Tokens (Magic Links)
export const verificationTokens = pgTable(
    "verificationToken",
    {
        identifier: text("identifier").notNull(),
        token: text("token").notNull(),
        expires: timestamp("expires", { mode: "date" }).notNull(),
    },
    (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// 5b. Password Reset Tokens
export const passwordResetTokens = pgTable("password_reset_token", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    token: text("token").unique().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});


// 6. Blog Posts
export const posts = pgTable("post", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    slug: text("slug").unique().notNull(),
    content: text("content"), // JSON content from Tiptap or HTML
    published: boolean("published").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    authorId: text("authorId")
        .references(() => users.id, { onDelete: "set null" }), // Keep post if author deleted
    coverImage: text("coverImage"),
    excerpt: text("excerpt"),
}, (t) => [
    index("idx_posts_published_created").on(t.published, t.createdAt),
]);

// 7. Case Studies (CMS)
export const caseStudies = pgTable("case_study", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    slug: text("slug").unique().notNull(),
    description: text("description"), // Short description
    content: text("content"), // Full case study content
    clientName: text("clientName"),
    coverImage: text("coverImage"),
    galleryImages: jsonb("gallery_images").$type<string[]>().default([]).notNull(),
    technologies: jsonb("technologies").$type<string[]>().default([]).notNull(),
    published: boolean("published").default(false).notNull(),
    order: text("order").default("0").notNull(),
    status: contentStatusEnum("status").default("draft").notNull(),
    serviceId: text("service_id")
        .references(() => services.id, { onDelete: "set null" }),
    clientDisplayName: text("client_display_name"),
    clientConsent: boolean("client_consent").default(false).notNull(),
    summary: text("summary"),
    liveUrl: text("live_url"),
    sortOrder: integer("sort_order").default(0).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedBy: text("updated_by")
        .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("idx_case_studies_slug").on(t.slug),
    index("idx_case_studies_published").on(t.published),
]);

// 8. Services
export const services = pgTable("service", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category"),
    image: text("image"),
    color: text("color").default("#05160b"),
    link: text("link").default("/contact"),
    icon: text("icon"), // Name of Lucide icon
    order: integer("order").default(0),
    isFeatured: boolean("is_featured").default(false).notNull(),
    slug: text("slug"),
    inclusions: jsonb("inclusions").$type<string[]>().default([]),
    deliverables: jsonb("deliverables").$type<string[]>().default([]),
    scopeOverview: text("scope_overview"),
    timelineEstimate: text("timeline_estimate").default("2-4 Weeks"),
    targetAudience: text("target_audience"),
    status: contentStatusEnum("status").default("draft").notNull(),
    isPreset: boolean("is_preset").default(false).notNull(),
    showOnServicesPage: boolean("show_on_services_page").default(true).notNull(),
    showInInquiry: boolean("show_in_inquiry").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
}, (t) => [
    uniqueIndex("service_slug_unique").on(t.slug).where(sql`"slug" IS NOT NULL`),
]);

// 9. Testimonials
export const testimonials = pgTable("testimonial", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    role: text("role"),
    company: text("company"),
    content: text("content").notNull(),
    rating: integer("rating").default(5),
    image: text("image"),
    active: boolean("active").default(true),
});

export interface CompanyStat {
    label: string;
    value: string;
    description?: string;
}

export interface TechStackItem {
    name: string;
    category?: "Frontend" | "Backend" | "Database" | "Cloud" | "AI" | string;
    iconUrl?: string;
    imageUrl?: string;
}

// 10. Site Settings (Singleton)
export const siteSettings = pgTable("site_settings", {
    id: text("id").primaryKey().default("singleton_root"), // Ensure single row usage pattern
    heroTitle: text("heroTitle").default("Build the Future"),
    heroDescription: text("heroDescription").default("Premium software development agency crafting high-performance websites."),
    aboutText: text("aboutText"),
    logoUrl: text("logoUrl"),
    logoDarkUrl: text("logoDarkUrl"),
    faviconUrl: text("faviconUrl"),
    contactEmail: text("contactEmail"),
    notificationEmails: jsonb("notificationEmails").$type<string[]>().default([]).notNull(),
    demoVideoUrl: text("demoVideoUrl"), // URL for the homepage demo video (YouTube/Vimeo embed or direct)
    faqs: jsonb("faqs").$type<{ question: string, answer: string }[]>().default([]).notNull(),

    // About Page Content
    aboutHeroTitle: text("about_hero_title").default("About Our Agency"),
    missionStatement: text("mission_statement"),
    companyStats: jsonb("company_stats").$type<CompanyStat[]>().default([]).notNull(),
    aboutTechStack: text("about_tech_stack").default("Powered By Next-Generation Technologies"),
    aboutTechStackItems: jsonb("about_tech_stack_items").$type<TechStackItem[]>().default([]).notNull(),
    aboutCtaHeadline: text("about_cta_headline").default("Ready to start your next project?"),
    aboutCtaText: text("about_cta_text").default("Let's build something extraordinary together."),
}, (t) => [
    check("site_settings_singleton_check", sql`${t.id} = 'singleton_root'`),
]);

// 10b. About Page Values (Bento Cards)
export const aboutValues = pgTable("about_value", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description").notNull(),
    icon: text("icon").default("Zap"), // Lucide icon name
    order: integer("order").default(0).notNull(),
});

// 10c. Public Website Pages & Version History (Content Editor C1-C9)
export interface HomePageFields {
    heading: string;
    intro: string;
    mainImageUrl: string;
    featuredServiceIds: string[];
    featuredPortfolioIds: string[];
}

export interface AboutTeamMemberItem {
    name: string;
    jobTitle: string;
    photoUrl: string;
}

export interface AboutPageFields {
    heading: string;
    story: string;
    mission: string;
    vision: string;
    howWeWork: string;
    team: AboutTeamMemberItem[];
}

export interface ContactPageFields {
    heading: string;
    intro: string;
    email: string;
    phone: string;
    address: string;
    officeHours: string;
}

export type PageFieldsMap = {
    home: HomePageFields;
    about: AboutPageFields;
    contact: ContactPageFields;
};

export type PageSlug = keyof PageFieldsMap;

export const pages = pgTable("pages", {
    slug: text("slug").primaryKey(),
    fields: jsonb("fields").$type<Record<string, unknown>>().default({}).notNull(),
    draftFields: jsonb("draft_fields").$type<Record<string, unknown>>(),
    status: contentStatusEnum("status").default("draft").notNull(),
    version: integer("version").default(0).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by")
        .references(() => users.id, { onDelete: "set null" }),
    draftUpdatedAt: timestamp("draft_updated_at", { withTimezone: true }),
    draftUpdatedBy: text("draft_updated_by")
        .references(() => users.id, { onDelete: "set null" }),
}, (t) => [
    check("pages_slug_check", sql`${t.slug} IN ('home', 'about', 'contact')`),
]);

export const pageVersions = pgTable("page_version", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    pageSlug: text("page_slug")
        .notNull()
        .references(() => pages.slug, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    fields: jsonb("fields").$type<Record<string, unknown>>().notNull(),
    action: text("action").notNull(),
    restoredFrom: integer("restored_from"),
    createdBy: text("created_by")
        .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    uniqueIndex("page_version_slug_version_unique").on(t.pageSlug, t.versionNo),
    check("page_version_action_check", sql`${t.action} IN ('publish', 'restore')`),
]);

// 11. Casual Inquiries (Contact Us Form)
export const inquiryStatusEnum = pgEnum("inquiry_status", ["Unread", "Read", "Archived"]);

export const inquiries = pgTable("inquiry", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject"),
    message: text("message").notNull(),
    status: inquiryStatusEnum("status").default("Unread").notNull(),
    source: text("source").default("Website Form"),
    ownerId: text("ownerId")
        .references(() => users.id, { onDelete: "set null" }),
    nextAction: text("nextAction"),
    isHandled: boolean("isHandled").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 12. Leads (CRM Core - True Bottom of Funnel)
export const leadEnum = pgEnum("lead_status", [
    "New Lead",
    "Discovery & Qualifying",
    "Proposal Sent",
    "In Negotiation",
    "Closed Won",
    "Closed Lost"
]);
export const lossReasonEnum = pgEnum("loss_reason", [
    "budget_too_low",
    "competitor_chosen",
    "scope_mismatch",
    "timing_ghosted",
    "internal_cancellation",
    "other"
]);
export const activityEnum = pgEnum("activity_type", ["System", "Note", "Email", "Call", "Meeting", "outside_discussion"]);
export const qualificationStatusEnum = pgEnum("qualification_status", ["Lead", "MQL", "SQL"]);
export const clientTypeEnum = pgEnum("client_type", ["local", "international"]);

export const leads = pgTable("lead", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    clientId: text("clientId")
        .references(() => users.id, { onDelete: "set null" }),
    serviceId: text("serviceId")
        .references(() => services.id, { onDelete: "set null" }),
    businessName: text("business_name"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    budget: text("budget"),
    estimatedValue: integer("estimated_value").default(0).notNull(),

    qualificationStatus: qualificationStatusEnum("qualification_status").default("Lead").notNull(),
    priority: text("priority").default("Warm").notNull(),
    goals: text("goals"),
    industry: text("industry"),
    targetAudience: text("target_audience"),
    timelineExpectation: text("timeline_expectation"),
    status: leadEnum("status").default("New Lead").notNull(),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }),
    source: text("source").default("Client Portal Intake"),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    nextFollowUpDate: timestamp("next_follow_up_date", { withTimezone: true }),
    lossReason: lossReasonEnum("loss_reason"),
    lossNotes: text("loss_notes"),
    isArchived: boolean("isArchived").default(false).notNull(),
    closedWonAt: timestamp("closed_won_at", { withTimezone: true }),
    urgency: text("urgency"),
    roleInCompany: text("role_in_company"),
    contactPreference: text("contact_preference"),
    otherServiceText: text("other_service_text"),
    details: text("details"),
    clientType: clientTypeEnum("client_type").default("local").notNull(),
    proposalRequestedAt: timestamp("proposal_requested_at", { withTimezone: true }),
    assignedPmId: text("assigned_pm_id").references(() => users.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("idx_lead_status_archived").on(t.status, t.isArchived),
    index("idx_lead_archived_at").on(t.archivedAt),
    index("idx_lead_client").on(t.clientId),
    index("idx_lead_last_contacted").on(t.lastContactedAt),
]);

export const leadAssignees = pgTable("lead_assignee", {
    leadId: text("leadId")
        .notNull()
        .references(() => leads.id, { onDelete: "cascade" }),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.leadId, t.userId] }) }));

// 13. Lead Activity Logs (Audit Trail / Advanced Comments)
export const leadActivityLogs = pgTable("lead_activity_log", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    leadId: text("leadId")
        .notNull()
        .references(() => leads.id, { onDelete: "cascade" }),
    authorId: text("authorId")
        .references(() => users.id, { onDelete: "set null" }), // Nullable for System events
    activityType: activityEnum("activity_type").default("System").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 13. Notifications
export const notifications = pgTable("notification", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    type: text("type"), // e.g., "lead", "feedback", "proposal", "milestone", "system"
    read: boolean("read").default(false).notNull(),
    link: text("link"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});


// 13b. Meetings
export const meetingTypeEnum = pgEnum("meeting_type", [
    "discovery",
    "budget_pricing",
    "project_review",
    "uat"
]);
export const meetingFormatEnum = pgEnum("meeting_format", [
    "video",
    "phone",
    "in_person",
    "on_site"
]);
export const meetingStatusEnum = pgEnum("meeting_status", [
    "awaiting_client",
    "confirmed",
    "reschedule_requested",
    "done",
    "cancelled"
]);

export const meetings = pgTable("meeting", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    leadId: text("leadId")
        .references(() => leads.id, { onDelete: "cascade" }),
    proposalId: text("proposalId")
        .references(() => proposals.id, { onDelete: "set null" }),
    projectId: text("projectId")
        .references(() => agencyProjects.id, { onDelete: "set null" }),
    type: meetingTypeEnum("type").default("discovery").notNull(),
    format: meetingFormatEnum("format").default("video").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    attendees: jsonb("attendees").$type<string[]>().default([]).notNull(),
    agenda: text("agenda"),
    notes: text("notes"),
    status: meetingStatusEnum("status").default("awaiting_client").notNull(),
    reminderSent: boolean("reminder_sent").default(false).notNull(),
    clientSuggestedAt: timestamp("client_suggested_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    createdBy: text("createdBy")
        .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    index("idx_meeting_lead").on(t.leadId),
    index("idx_meeting_starts_at").on(t.startsAt),
    index("idx_meeting_status").on(t.status),
]);


// 13c. Discovery Forms
export const discoveryForms = pgTable("discovery_form", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    leadId: text("leadId")
        .notNull()
        .references(() => leads.id, { onDelete: "cascade" }),
    goals: text("goals").notNull(),
    requiredFeatures: text("required_features").notNull(),
    targetTimeline: text("target_timeline").notNull(),
    budgetRange: text("budget_range").notNull(),
    clientType: clientTypeEnum("client_type").default("local").notNull(),
    notes: text("notes"),
    submittedBy: text("submitted_by")
        .references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    index("idx_discovery_form_lead").on(t.leadId),
]);

// 14. Proposals
export const proposalStatusEnum = pgEnum("proposal_status", [
    "draft",
    "sent",
    "pricing_meeting_requested",
    "changes_requested",
    "signed",
    "declined",
    "replaced",
]);

export const priceModeEnum = pgEnum("price_mode", ["to_be_discussed", "priced"]);
export const currencyEnum = pgEnum("currency", ["PHP", "USD"]);
export const milestoneNameEnum = pgEnum("milestone_name", [
    "requirements",
    "design",
    "development",
    "uat_testing",
    "handover",
]);
export const paymentTriggerEnum = pgEnum("payment_trigger", [
    "on_signing",
    "requirements",
    "design",
    "development",
    "uat_testing",
    "handover",
    "before_completion",
]);

export const proposals = pgTable("proposal", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    leadId: text("leadId")
        .notNull()
        .references(() => leads.id, { onDelete: "cascade" }),
    proposalCode: text("proposal_code"),
    scope: text("scope"),
    deliverables: jsonb("deliverables"),
    timeline: text("timeline"),
    technicalApproach: text("technicalApproach"),
    pricingStructure: jsonb("pricingStructure"),
    subtotal: integer("subtotal").default(0),
    discount: integer("discount").default(0),
    tax: integer("tax").default(0),
    total: integer("total").default(0),
    terms: text("terms"),
    validUntil: timestamp("valid_until"),
    version: integer("version").notNull().default(1),
    status: proposalStatusEnum("status").default("draft").notNull(),
    priceMode: priceModeEnum("price_mode").default("to_be_discussed").notNull(),
    currency: currencyEnum("currency").default("PHP").notNull(),
    totalPrice: integer("total_price"),
    needsGoals: jsonb("needs_goals").$type<{ needs: string; goals: string }>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    fileUrl: text("fileUrl"),
    rejectionReason: text("rejection_reason"),
    // Hybrid Digital Signature Metadata
    acceptedByName: text("accepted_by_name"),
    acceptedByEmail: text("accepted_by_email"),
    acceptedByTitle: text("accepted_by_title"),
    signatureData: text("signature_data"),
    acceptedAt: timestamp("accepted_at"),
    acceptedIp: text("accepted_ip"),
    acceptedUserAgent: text("accepted_user_agent"),
    signerName: text("signer_name"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signerIp: text("signer_ip"),
    signatureType: text("signature_type"),
    signedFileUrl: text("signed_file_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    contractSettings: jsonb("contractSettings").$type<{
        clientAddress?: string;
        clientPhone?: string;
        clientContactPerson?: string;
        agencyAddress?: string;
        agencyPhone?: string;
        agencyRegistration?: string;
        governingLaw?: string;
        paymentMethod?: string;
        includeConfidentiality?: boolean;
        includeIpClause?: boolean;
        includeLiabilityClause?: boolean;
        includeForceClause?: boolean;
        includeChangeOrder?: boolean;
        includeDisputeResolution?: boolean;
        customClauses?: string;
    }>(),
}, (t) => [
    index("idx_proposal_lead").on(t.leadId),
    index("idx_proposal_code").on(t.proposalCode),
    uniqueIndex("idx_proposal_lead_version").on(t.leadId, t.version),
    uniqueIndex("idx_proposal_one_signed_per_lead").on(t.leadId).where(sql`"status" = 'signed'`),
    check("proposal_signature_type_check", sql`${t.signatureType} IN ('online', 'paper')`),
]);

export const proposalMilestones = pgTable("proposal_milestone", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    proposalId: text("proposal_id")
        .notNull()
        .references(() => proposals.id, { onDelete: "cascade" }),
    name: milestoneNameEnum("name").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    uniqueIndex("proposal_milestone_proposal_name_idx").on(t.proposalId, t.name)
]);

export const paymentScheduleItems = pgTable("payment_schedule_item", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    proposalId: text("proposal_id")
        .notNull()
        .references(() => proposals.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    percent: integer("percent").notNull(),
    trigger: paymentTriggerEnum("trigger").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    index("idx_payment_schedule_item_proposal_id").on(t.proposalId),
]);

export const proposalMessages = pgTable("proposal_message", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    proposalId: text("proposal_id")
        .notNull()
        .references(() => proposals.id, { onDelete: "cascade" }),
    authorId: text("author_id")
        .references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    topics: jsonb("topics")
        .$type<string[]>()
        .default([])
        .notNull(),
    body: text("body").notNull(),
    outsideType: text("outside_type"),
    heldAt: timestamp("held_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    index("idx_proposal_message_proposal").on(t.proposalId),
    check("proposal_message_kind_check", sql`${t.kind} IN ('change_request', 'message', 'reply', 'outside_discussion')`),
    check("proposal_message_outside_type_check", sql`${t.outsideType} IN ('call', 'email', 'in_person')`),
]);



// 15. Audit Logs
export const auditActionEnum = pgEnum("audit_action", ["CREATE", "UPDATE", "DELETE", "LOGIN", "OTHER"]);

export const auditLogs = pgTable("audit_log", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
        .references(() => users.id, { onDelete: "set null" }), // Keep log even if user is deleted
    projectId: text("project_id"), // No FK: rows must outlive projects (see 0015_session8_sprints.sql for idx_audit_project)
    action: auditActionEnum("action").notNull(),
    entity: text("entity").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 15a. System Error Logs & Diagnostics
export const errorSeverityEnum = pgEnum("error_severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const systemErrorLogs = pgTable("system_error_log", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    errorCode: text("error_code").notNull().default("UNKNOWN_ERROR"),
    severity: errorSeverityEnum("severity").notNull().default("MEDIUM"),
    message: text("message").notNull(),
    stackTrace: text("stack_trace"),
    source: text("source").notNull(), // e.g. "action:pm", "action:crm", "route:api", "boundary:app"
    context: jsonb("context").$type<Record<string, unknown>>().default({}),
    userId: text("userId").references(() => users.id, { onDelete: "set null" }),
    isResolved: boolean("is_resolved").default(false).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    index("idx_error_created").on(t.createdAt),
    index("idx_error_severity").on(t.severity),
    index("idx_error_resolved").on(t.isResolved),
    index("idx_error_code").on(t.errorCode),
]);


// 15b. CRM Tasks
export const crmTaskStatusEnum = pgEnum("crm_task_status", [
    "Pending",
    "In Progress",
    "Completed",
    "Canceled",
]);
export const crmTaskTypeEnum = pgEnum("crm_task_type", [
    "Call",
    "Email",
    "Meeting",
    "To-do",
]);
export const crmTaskPriorityEnum = pgEnum("crm_task_priority", [
    "Low",
    "Medium",
    "High",
]);

export const crmTasks = pgTable("crm_task", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    leadId: text("leadId")
        .notNull()
        .references(() => leads.id, { onDelete: "cascade" }),
    assignedTo: text("assignedTo")
        .references(() => users.id, { onDelete: "set null" }), // Sales Rep
    title: text("title").notNull(),
    description: text("description"),
    taskType: crmTaskTypeEnum("task_type").default("To-do").notNull(),
    status: crmTaskStatusEnum("status").default("Pending").notNull(),
    priority: crmTaskPriorityEnum("priority").default("Medium").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    index("idx_crm_task_lead").on(t.leadId),
    index("idx_crm_task_assignee_status").on(t.assignedTo, t.status),
    index("idx_crm_task_due_status").on(t.dueDate, t.status),
]);

// --- RELATIONS ---
import { relations } from "drizzle-orm";

export const leadsRelations = relations(leads, ({ one, many }) => ({
    activityLogs: many(leadActivityLogs),
    assignees: many(leadAssignees),
    proposals: many(proposals),
    meetings: many(meetings),
    discoveryForms: many(discoveryForms),
    crmTasks: many(crmTasks),
    client: one(users, {
        fields: [leads.clientId],
        references: [users.id],
    }),
    service: one(services, {
        fields: [leads.serviceId],
        references: [services.id],
    }),
    assignedPm: one(users, {
        fields: [leads.assignedPmId],
        references: [users.id],
    })
}));

export const leadAssigneesRelations = relations(leadAssignees, ({ one }) => ({
    lead: one(leads, {
        fields: [leadAssignees.leadId],
        references: [leads.id],
    }),
    user: one(users, {
        fields: [leadAssignees.userId],
        references: [users.id],
    }),
}));

export const leadActivityLogsRelations = relations(leadActivityLogs, ({ one }) => ({
    lead: one(leads, {
        fields: [leadActivityLogs.leadId],
        references: [leads.id],
    }),
    author: one(users, {
        fields: [leadActivityLogs.authorId],
        references: [users.id],
    }),
}));

export const usersRelations = relations(users, ({ many }) => ({
    leadAssignments: many(leadAssignees),
    authoredActivityLogs: many(leadActivityLogs),
    meetingsCreated: many(meetings),
    projectStakeholds: many(projectStakeholders),
    projectTeamMemberships: many(projectTeamMembers),
    taskAssignments: many(taskAssignees),
    crmTaskAssignments: many(crmTasks),
    notifications: many(notifications),
    documents: many(document, { relationName: "documentUploader" }),
    projectFeedback: many(projectFeedback),
    auditLogs: many(auditLogs),
    inquiries: many(inquiries),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
    lead: one(leads, {
        fields: [proposals.leadId],
        references: [leads.id],
    }),
    milestones: many(proposalMilestones),
    paymentScheduleItems: many(paymentScheduleItems),
    messages: many(proposalMessages),
}));

export const proposalMessagesRelations = relations(proposalMessages, ({ one }) => ({
    proposal: one(proposals, {
        fields: [proposalMessages.proposalId],
        references: [proposals.id],
    }),
    author: one(users, {
        fields: [proposalMessages.authorId],
        references: [users.id],
    }),
}));

export const paymentScheduleItemsRelations = relations(paymentScheduleItems, ({ one, many }) => ({
    proposal: one(proposals, {
        fields: [paymentScheduleItems.proposalId],
        references: [proposals.id],
    }),
    payments: many(payments),
}));

export const proposalMilestonesRelations = relations(proposalMilestones, ({ one }) => ({
    proposal: one(proposals, {
        fields: [proposalMilestones.proposalId],
        references: [proposals.id],
    }),
}));

export const crmTasksRelations = relations(crmTasks, ({ one }) => ({
    lead: one(leads, {
        fields: [crmTasks.leadId],
        references: [leads.id],
    }),
    assignee: one(users, {
        fields: [crmTasks.assignedTo],
        references: [users.id],
    }),
}));

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
    owner: one(users, {
        fields: [inquiries.ownerId],
        references: [users.id],
    }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    user: one(users, {
        fields: [auditLogs.userId],
        references: [users.id],
    }),
}));

export const systemErrorLogsRelations = relations(systemErrorLogs, ({ one }) => ({
    user: one(users, {
        fields: [systemErrorLogs.userId],
        references: [users.id],
    }),
    resolvedBy: one(users, {
        fields: [systemErrorLogs.resolvedById],
        references: [users.id],
    }),
}));

// 13. Operational Project Management (PM Engine)
export const agencyProjectStatusEnum = pgEnum("agency_project_status", ["Kickoff", "In Progress", "In Review", "Completed"]);
export const milestoneStatusEnum = pgEnum("milestone_status", ["Pending", "In Progress", "Completed"]);
export const taskStatusEnum = pgEnum("task_status", ["backlog", "to_do", "in_progress", "in_review", "changes_requested", "done"]);

export type ProjectDocumentItem = {
    id: string;
    title: string;
    url: string;
    type: "pdf" | "doc" | "figma" | "sheet" | "link" | "zip" | "image";
    sizeBytes?: number;
    uploadedById?: string;
    uploadedByName?: string;
    uploadedByRole?: "client" | "agency";
    createdAt?: string;
};

export const agencyProjects = pgTable("agency_project", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    progressPercentage: integer("progress_percentage").default(0).notNull(),
    description: text("description"),
    sourceBrief: text("source_brief"), // NEW: The raw text that generated this project
    leadId: text("leadId")
        .references(() => leads.id, { onDelete: "set null" }), // Link back to originating lead
    status: agencyProjectStatusEnum("status").default("Kickoff").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    targetDate: timestamp("target_date", { mode: "date" }),
    stagingUrls: text("staging_urls").array(), // For Figma/Live links
    documents: jsonb("documents").$type<ProjectDocumentItem[]>(), // For PDFs, Docs, Figma, Sheets
    signedOffBy: text("signed_off_by").references(() => users.id, { onDelete: "set null" }),
    signedOffAt: timestamp("signed_off_at", { withTimezone: true }),
    signOffFileUrl: text("sign_off_file_url"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    warrantyEndsAt: timestamp("warranty_ends_at", { withTimezone: true }),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
}, (t) => [
    index("idx_project_lead").on(t.leadId),
    index("idx_project_status").on(t.status)
]);

export const projectStakeholders = pgTable("project_stakeholder", {
    projectId: text("projectId")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.projectId, t.userId] }) }));

export const projectTeamMembers = pgTable("project_team_member", {
    projectId: text("projectId")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    roleInProject: text("role_in_project"),
    isAssignable: boolean("is_assignable").default(true).notNull(),
    addedBy: text("added_by")
        .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.projectId, t.userId] }) }));



export const milestones = pgTable("milestone", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    projectId: text("projectId")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    name: milestoneNameEnum("name"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    title: text("title").notNull(),
    status: milestoneStatusEnum("status").default("Pending").notNull(),
    order: integer("order").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    doneReason: text("done_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
}, (t) => [
    index("idx_milestone_project").on(t.projectId),
    uniqueIndex("idx_milestone_project_name").on(t.projectId, t.name).where(sql`"name" IS NOT NULL`),
]);

// Note: sprint_no_overlap exclusion constraint, sprint_id_project_uniq, and idx_sprint_project_name are defined in src/db/migrations/0015_session8_sprints.sql
export const sprints = pgTable("sprint", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    goal: text("goal"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    createdBy: text("created_by")
        .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    check("sprint_dates_check", sql`${t.endDate} >= ${t.startDate}`),
]);

// Note: composite FK task_sprint_same_project_fk (sprint_id, "projectId") -> sprint(id, project_id) and partial index idx_task_sprint are defined in src/db/migrations/0015_session8_sprints.sql
export const tasks = pgTable("task", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    projectId: text("projectId")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    milestoneId: text("milestoneId")
        .notNull()
        .references(() => milestones.id, { onDelete: "cascade" }),
    sprintId: text("sprint_id"),
    carriedOver: boolean("carried_over").default(false).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    dependsOnTaskId: text("dependsOnTaskId"),
    dueDate: timestamp("due_date", { mode: "date" }),
    status: taskStatusEnum("status").default("to_do").notNull(),
    weight: integer("weight").notNull().default(1),
    estimatedHours: integer("estimated_hours"),
    proofLinks: jsonb("proof_links").$type<{ label: string; url: string }[]>().default([]),
    proofNotes: text("proof_notes"),
    requiresProof: boolean("requires_proof").default(true).notNull(),
    isBlockedByClient: boolean("is_blocked_by_client").default(false).notNull(),
    blockedReason: text("blocked_reason"),
    overdueNotified: boolean("overdue_notified").default(false).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
}, (t) => ({
    dependsOnFk: foreignKey({
        columns: [t.dependsOnTaskId],
        foreignColumns: [t.id],
        name: "task_depends_on_fk"
    }).onDelete("set null"),
    idxProjectDeleted: index("idx_task_project_deleted").on(t.projectId, t.deletedAt),
    idxMilestoneDeleted: index("idx_task_milestone_deleted").on(t.milestoneId, t.deletedAt),
    idxTaskProjectStatus: index("idx_task_project_status").on(t.projectId, t.status),
    idxTaskMilestoneStatus: index("idx_task_milestone_status").on(t.milestoneId, t.status),
}));

export const taskAssignees = pgTable("task_assignee", {
    taskId: text("taskId")
        .notNull()
        .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.taskId, t.userId] }) }));

export const taskSubmissions = pgTable("task_submission", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    taskId: text("taskId")
        .notNull()
        .references(() => tasks.id, { onDelete: "cascade" }),
    submittedBy: text("submitted_by"),
    proofUrl: text("proof_url").notNull(),
    submissionNotes: text("submission_notes").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
    idxTaskSubmissionTaskCreated: index("idx_task_submission_task_created").on(t.taskId, t.createdAt),
}));

// 14. Documents (Handover Files)
export const document = pgTable("document", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size"),
    uploadedBy: text("uploaded_by")
        .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 14b. Project Feedback
export const projectFeedback = pgTable("project_feedback", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    clientId: text("client_id")
        .references(() => users.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    uniqueIndex("idx_project_feedback_one").on(t.projectId, t.clientId),
    check("project_feedback_rating_range", sql`"rating" >= 1 AND "rating" <= 5`),
]);

// 15. Payments
export const paymentStatusEnum = pgEnum("payment_status", [
    "not_yet_due",
    "due",
    "proof_uploaded",
    "paid",
]);

export const payments = pgTable("payment", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    scheduleItemId: text("schedule_item_id")
        .references(() => paymentScheduleItems.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    percent: integer("percent").notNull(),
    amount: integer("amount").notNull(),
    currency: currencyEnum("currency").notNull(),
    status: paymentStatusEnum("status").default("not_yet_due").notNull(),
    becameDueAt: timestamp("became_due_at", { withTimezone: true }),
    method: paymentMethodEnum("method"),
    referenceNo: text("reference_no"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    orNumber: text("or_number"),
    proofFileUrl: text("proof_file_url"),
    proofUploadedAt: timestamp("proof_uploaded_at", { withTimezone: true }),
    proofRejectedReason: text("proof_rejected_reason"),
    confirmedBy: text("confirmed_by").references(() => users.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    index("idx_payment_project").on(t.projectId),
    uniqueIndex("idx_payment_project_item").on(t.projectId, t.scheduleItemId).where(sql`"schedule_item_id" IS NOT NULL`),
    uniqueIndex("idx_payment_or_number").on(t.orNumber).where(sql`"or_number" IS NOT NULL`),
    check("payment_paid_fields_check", sql`"status" <> 'paid' OR ("method" IS NOT NULL AND "received_at" IS NOT NULL AND "or_number" IS NOT NULL AND ("method" = 'cash' OR "reference_no" IS NOT NULL))`),
]);

// PM Relations


export const discoveryFormsRelations = relations(discoveryForms, ({ one }) => ({
    lead: one(leads, {
        fields: [discoveryForms.leadId],
        references: [leads.id],
    }),
    submitter: one(users, {
        fields: [discoveryForms.submittedBy],
        references: [users.id],
    }),
}));

export const meetingsRelations = relations(meetings, ({ one }) => ({
    lead: one(leads, {
        fields: [meetings.leadId],
        references: [leads.id],
    }),
    proposal: one(proposals, {
        fields: [meetings.proposalId],
        references: [proposals.id],
    }),
    project: one(agencyProjects, {
        fields: [meetings.projectId],
        references: [agencyProjects.id],
    }),
    creator: one(users, {
        fields: [meetings.createdBy],
        references: [users.id],
    }),
}));

export const agencyProjectsRelations = relations(agencyProjects, ({ one, many }) => ({
    stakeholders: many(projectStakeholders),
    teamMembers: many(projectTeamMembers),
    lead: one(leads, {
        fields: [agencyProjects.leadId],
        references: [leads.id],
    }),
    milestones: many(milestones),
    sprints: many(sprints),
    tasks: many(tasks),
    payments: many(payments),
    documents: many(document),
    feedback: many(projectFeedback),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    project: one(agencyProjects, {
        fields: [payments.projectId],
        references: [agencyProjects.id],
    }),
    scheduleItem: one(paymentScheduleItems, {
        fields: [payments.scheduleItemId],
        references: [paymentScheduleItems.id],
    }),
    confirmedByUser: one(users, {
        fields: [payments.confirmedBy],
        references: [users.id],
    }),
}));

export const projectTeamMembersRelations = relations(projectTeamMembers, ({ one }) => ({
    project: one(agencyProjects, {
        fields: [projectTeamMembers.projectId],
        references: [agencyProjects.id],
    }),
    user: one(users, {
        fields: [projectTeamMembers.userId],
        references: [users.id],
    }),
}));

export const projectStakeholdersRelations = relations(projectStakeholders, ({ one }) => ({
    project: one(agencyProjects, {
        fields: [projectStakeholders.projectId],
        references: [agencyProjects.id],
    }),
    user: one(users, {
        fields: [projectStakeholders.userId],
        references: [users.id],
    }),
}));



export const milestonesRelations = relations(milestones, ({ one, many }) => ({
    project: one(agencyProjects, {
        fields: [milestones.projectId],
        references: [agencyProjects.id],
    }),
    tasks: many(tasks),

}));

export const documentRelations = relations(document, ({ one }) => ({
    project: one(agencyProjects, {
        fields: [document.projectId],
        references: [agencyProjects.id],
    }),
    uploader: one(users, {
        fields: [document.uploadedBy],
        references: [users.id],
        relationName: "documentUploader",
    }),
}));

export const projectFeedbackRelations = relations(projectFeedback, ({ one }) => ({
    project: one(agencyProjects, {
        fields: [projectFeedback.projectId],
        references: [agencyProjects.id],
    }),
    client: one(users, {
        fields: [projectFeedback.clientId],
        references: [users.id],
    }),
}));

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
    project: one(agencyProjects, {
        fields: [sprints.projectId],
        references: [agencyProjects.id],
    }),
    creator: one(users, {
        fields: [sprints.createdBy],
        references: [users.id],
    }),
    tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
    project: one(agencyProjects, {
        fields: [tasks.projectId],
        references: [agencyProjects.id],
    }),
    milestone: one(milestones, {
        fields: [tasks.milestoneId],
        references: [milestones.id],
    }),
    sprint: one(sprints, {
        fields: [tasks.sprintId],
        references: [sprints.id],
    }),
    assignees: many(taskAssignees),
    dependsOn: one(tasks, {
        fields: [tasks.dependsOnTaskId],
        references: [tasks.id],
        relationName: "taskDependencies",
    }),
    dependents: many(tasks, { relationName: "taskDependencies" }),
    submissions: many(taskSubmissions),
}));

export const taskSubmissionsRelations = relations(taskSubmissions, ({ one }) => ({
    task: one(tasks, {
        fields: [taskSubmissions.taskId],
        references: [tasks.id],
    }),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
    task: one(tasks, {
        fields: [taskAssignees.taskId],
        references: [tasks.id],
    }),
    user: one(users, {
        fields: [taskAssignees.userId],
        references: [users.id],
    }),
}));

// 16. Service Templates
export const serviceTemplates = pgTable("service_template", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull().unique(), // e.g., "Web Development"
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskTemplates = pgTable("task_template", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    serviceTemplateId: text("serviceTemplateId")
        .notNull()
        .references(() => serviceTemplates.id, { onDelete: "cascade" }),
    milestoneTitle: text("milestone_title").notNull(), // e.g., "Design"
    milestoneOrder: integer("milestone_order").notNull(), // e.g., 2
    title: text("title").notNull(), // e.g., "Setup Figma"
    description: text("description"),
    requiresProof: boolean("requires_proof").default(false).notNull(),
    order: integer("order").default(0).notNull(),
});

// Relations for Templates
export const serviceTemplatesRelations = relations(serviceTemplates, ({ many }) => ({
    tasks: many(taskTemplates),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ one }) => ({
    serviceTemplate: one(serviceTemplates, {
        fields: [taskTemplates.serviceTemplateId],
        references: [serviceTemplates.id],
    }),
}));

// Relations for CMS (Services, Case Studies, Pages, Page Versions)
export const servicesRelations = relations(services, ({ many }) => ({
    caseStudies: many(caseStudies),
    leads: many(leads),
}));

export const caseStudiesRelations = relations(caseStudies, ({ one }) => ({
    service: one(services, {
        fields: [caseStudies.serviceId],
        references: [services.id],
    }),
    updatedByUser: one(users, {
        fields: [caseStudies.updatedBy],
        references: [users.id],
    }),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
    publishedByUser: one(users, {
        fields: [pages.publishedBy],
        references: [users.id],
        relationName: "pagePublishedBy",
    }),
    draftUpdatedByUser: one(users, {
        fields: [pages.draftUpdatedBy],
        references: [users.id],
        relationName: "pageDraftUpdatedBy",
    }),
    versions: many(pageVersions),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
    page: one(pages, {
        fields: [pageVersions.pageSlug],
        references: [pages.slug],
    }),
    author: one(users, {
        fields: [pageVersions.createdBy],
        references: [users.id],
    }),
}));
