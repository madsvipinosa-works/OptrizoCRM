import {
    boolean,
    timestamp,
    pgTable,
    text,
    primaryKey,
    integer,
    pgEnum,
    AnyPgColumn,
    foreignKey,
    index,
    jsonb,
    check
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccount } from "next-auth/adapters";

// 1. Enums (Single Source of Truth)
export const roleEnum = pgEnum("role", ["superadmin", "sales", "manager", "developer", "content_editor", "client"]);

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
    published: boolean("published").default(true).notNull(),
    order: text("order").default("0").notNull(),
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
    icon: text("icon"), // Name of Lucide icon
    order: integer("order").default(0),
});

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
    faviconUrl: text("faviconUrl"),
    contactEmail: text("contactEmail"),
    notificationEmails: jsonb("notificationEmails").$type<string[]>().default([]).notNull(),
    demoVideoUrl: text("demoVideoUrl"), // URL for the homepage demo video (YouTube/Vimeo embed or direct)

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
export const activityEnum = pgEnum("activity_type", ["System", "Note", "Email", "Call", "Meeting"]);

export const leads = pgTable("lead", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    clientId: text("clientId")
        .notNull()
        .references(() => users.id, { onDelete: "set null" }), 
    serviceId: text("serviceId")
        .references(() => services.id, { onDelete: "set null" }), 
    businessName: text("business_name"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    budget: text("budget"),
    estimatedValue: integer("estimated_value").default(0).notNull(),
    leadScore: integer("lead_score").default(50).notNull(),
    priority: text("priority").default("Warm").notNull(),
    goals: text("goals"),
    industry: text("industry"),
    targetAudience: text("target_audience"),
    timelineExpectation: text("timeline_expectation"),
    status: leadEnum("status").default("New Lead").notNull(),
    source: text("source").default("Client Portal Intake"),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    nextFollowUpDate: timestamp("next_follow_up_date", { withTimezone: true }),
    lossReason: lossReasonEnum("loss_reason"),
    lossNotes: text("loss_notes"),
    isArchived: boolean("isArchived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("idx_lead_status_archived").on(t.status, t.isArchived),
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

// 14. Proposals
export const proposalStatusEnum = pgEnum("proposal_status", ["Draft", "Sent", "Approved", "Rejected"]);

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
    status: proposalStatusEnum("status").default("Draft").notNull(),
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
}, (t) => [
    index("idx_proposal_lead").on(t.leadId),
    index("idx_proposal_code").on(t.proposalCode),
]);

// 15. Audit Logs
export const auditActionEnum = pgEnum("audit_action", ["CREATE", "UPDATE", "DELETE", "LOGIN", "OTHER"]);

export const auditLogs = pgTable("audit_log", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
        .references(() => users.id, { onDelete: "set null" }), // Keep log even if user is deleted
    action: auditActionEnum("action").notNull(),
    entity: text("entity").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});


// --- RELATIONS ---
import { relations } from "drizzle-orm";

export const leadsRelations = relations(leads, ({ one, many }) => ({
    activityLogs: many(leadActivityLogs),
    assignees: many(leadAssignees),
    proposals: many(proposals),
    client: one(users, {
        fields: [leads.clientId],
        references: [users.id],
    }),
    service: one(services, {
        fields: [leads.serviceId],
        references: [services.id],
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
    projectStakeholds: many(projectStakeholders),
    taskAssignments: many(taskAssignees),
    notifications: many(notifications),
    clientFeedback: many(clientFeedback),
    auditLogs: many(auditLogs),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
    lead: one(leads, {
        fields: [proposals.leadId],
        references: [leads.id],
    }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    user: one(users, {
        fields: [auditLogs.userId],
        references: [users.id],
    }),
}));

// 13. Operational Project Management (PM Engine)
export const agencyProjectStatusEnum = pgEnum("agency_project_status", ["Kickoff", "In Progress", "In Review", "Completed"]);
export const milestoneStatusEnum = pgEnum("milestone_status", ["Pending", "In Progress", "Client Approval", "Completed"]);
export const taskStatusEnum = pgEnum("task_status", ["Todo", "In Progress", "Blocked", "In Review", "Done"]);

export type ProjectDocumentItem = {
    id: string;
    title: string;
    url: string;
    type: "pdf" | "doc" | "figma" | "sheet" | "link";
};

export const agencyProjects = pgTable("agency_project", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description"),
    leadId: text("leadId")
        .references(() => leads.id, { onDelete: "restrict" }), // Link back to originating lead
    status: agencyProjectStatusEnum("status").default("Kickoff").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    targetDate: timestamp("target_date", { mode: "date" }),
    stagingUrls: text("staging_urls").array(), // For Figma/Live links
    documents: jsonb("documents").$type<ProjectDocumentItem[]>(), // For PDFs, Docs, Figma, Sheets
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const projectStakeholders = pgTable("project_stakeholder", {
    projectId: text("projectId")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.projectId, t.userId] }) }));



export const milestones = pgTable("milestone", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    projectId: text("projectId")
        .notNull()
        .references(() => agencyProjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: milestoneStatusEnum("status").default("Pending").notNull(),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
});

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
    title: text("title").notNull(),
    description: text("description"),
    dependsOnTaskId: text("dependsOnTaskId"),
    dueDate: timestamp("due_date", { mode: "date" }),
    status: taskStatusEnum("status").default("Todo").notNull(),
    proofLinks: jsonb("proof_links").$type<{ label: string; url: string }[]>().default([]),
    proofNotes: text("proof_notes"),
    requiresProof: boolean("requires_proof").default(true).notNull(),
    isBlockedByClient: boolean("is_blocked_by_client").default(false).notNull(),
    blockedReason: text("blocked_reason"),
    overdueNotified: boolean("overdue_notified").default(false).notNull(),
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

// 14. Client Feedback
export const feedbackStatusEnum = pgEnum("feedback_status", ["APPROVED", "REVISION_REQUESTED"]);

export const clientFeedback = pgTable("client_feedback", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    milestoneId: text("milestoneId")
        .notNull()
        .references(() => milestones.id, { onDelete: "cascade" }),
    clientId: text("clientId")
        .references(() => users.id, { onDelete: "set null" }),
    status: feedbackStatusEnum("status").notNull(),
    commentText: text("comment_text"),
    parentFeedbackId: text("parentFeedbackId"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    parentFeedbackFk: foreignKey({
        columns: [t.parentFeedbackId],
        foreignColumns: [t.id],
        name: "parent_feedback_fk"
    }).onDelete("cascade")
}));

// PM Relations
export const agencyProjectsRelations = relations(agencyProjects, ({ one, many }) => ({
    stakeholders: many(projectStakeholders),
    lead: one(leads, {
        fields: [agencyProjects.leadId],
        references: [leads.id],
    }),
    milestones: many(milestones),
    tasks: many(tasks),
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
    feedback: many(clientFeedback),
}));

export const clientFeedbackRelations = relations(clientFeedback, ({ one, many }) => ({
    milestone: one(milestones, {
        fields: [clientFeedback.milestoneId],
        references: [milestones.id],
    }),
    client: one(users, {
        fields: [clientFeedback.clientId],
        references: [users.id],
    }),
    parent: one(clientFeedback, {
        fields: [clientFeedback.parentFeedbackId],
        references: [clientFeedback.id],
        relationName: "feedbackReplies",
    }),
    replies: many(clientFeedback, { relationName: "feedbackReplies" }),
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
    assignees: many(taskAssignees),
    dependsOn: one(tasks, {
        fields: [tasks.dependsOnTaskId],
        references: [tasks.id],
        relationName: "taskDependencies",
    }),
    dependents: many(tasks, { relationName: "taskDependencies" }),
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
