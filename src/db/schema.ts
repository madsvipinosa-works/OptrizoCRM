import {
    boolean,
    timestamp,
    pgTable,
    text,
    primaryKey,
    integer,
    pgEnum,

} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// 1. Enums (Single Source of Truth)
export const roleEnum = pgEnum("role", ["user", "admin", "editor", "client"]);

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
    role: roleEnum("role").default("user").notNull(),
    jobTitle: text("job_title"),
    isActive: boolean("is_active").default(true).notNull(),
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
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    coverImage: text("coverImage"),
    excerpt: text("excerpt"),
});

// 7. Projects / Case Studies
export const projects = pgTable("project", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    slug: text("slug").unique().notNull(),
    description: text("description"), // Short description
    content: text("content"), // Full case study content
    clientName: text("clientName"),
    coverImage: text("coverImage"),
    images: text("images").array(), // Array of image URLs
    status: text("status").default("published"), // published, draft
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

// 10. Site Settings (Singleton)
export const siteSettings = pgTable("site_settings", {
    id: text("id").primaryKey().default("1"), // Ensure single row usage pattern
    heroTitle: text("heroTitle").default("Build the Future"),
    heroDescription: text("heroDescription").default("Premium software development agency crafting high-performance websites."),
    aboutText: text("aboutText"),
    logoUrl: text("logoUrl"),
    faviconUrl: text("faviconUrl"),
    contactEmail: text("contactEmail"),
    notificationEmails: text("notificationEmails"), // Comma-separated list of admin emails
    demoVideoUrl: text("demoVideoUrl"), // URL for the homepage demo video (YouTube/Vimeo embed or direct)

    // Phase 5 Intelligence Settings
    monthlyMarketingSpend: integer("monthly_marketing_spend").default(1000).notNull(),
    adminHoursSavedPerProject: integer("admin_hours_saved_per_project").default(2).notNull(),
});

// 11. Contact Messages (Lead Capture)
// 11. Leads (CRM Core)
export const leadEnum = pgEnum("lead_status", ["New", "Contacted", "In Progress", "Completed", "Lost", "New Inquiry", "Qualified", "Proposal Sent", "Negotiation", "Won"]);
export const activityEnum = pgEnum("activity_type", ["Call", "Email", "Meeting", "Note"]);

export const leads = pgTable("lead", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject"),
    message: text("message").notNull(),
    status: leadEnum("status").default("New Inquiry").notNull(),
    score: integer("score").default(0),
    budget: text("budget"), // e.g., "$1k - $5k"
    service: text("service"), // e.g., "Web Development"
    industry: text("industry"),
    scope: text("scope"),
    source: text("source").default("Website Form"),
    notes: text("notes"), // Legacy simple notes (keeping for backward compatibility)
    assignedTo: text("assignedTo").references(() => users.id), // New: Assignment
    files: text("files").array(), // Array of file URLs (e.g., Proposals)
    nextActionDate: timestamp("next_action_date", { mode: "date" }), // Scheduled follow-up
    read: boolean("read").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 12. Lead Notes (Audit Trail / Advanced Comments)
export const leadNotes = pgTable("lead_note", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    leadId: text("leadId")
        .notNull()
        .references(() => leads.id, { onDelete: "cascade" }),
    authorId: text("authorId")
        .notNull()
        .references(() => users.id, { onDelete: "set null" }), // Keep note even if user deleted
    content: text("content").notNull(),
    activityType: activityEnum("activity_type").default("Note").notNull(),
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
    scope: text("scope"),
    deliverables: text("deliverables"),
    timeline: text("timeline"),
    technicalApproach: text("technicalApproach"),
    pricingStructure: text("pricingStructure"),
    status: proposalStatusEnum("status").default("Draft").notNull(),
    fileUrl: text("fileUrl"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
    notesList: many(leadNotes), // Changed name to avoid conflict with 'notes' column
    assignee: one(users, {
        fields: [leads.assignedTo],
        references: [users.id],
    }),
    proposals: many(proposals),
}));

export const leadNotesRelations = relations(leadNotes, ({ one }) => ({
    lead: one(leads, {
        fields: [leadNotes.leadId],
        references: [leads.id],
    }),
    author: one(users, {
        fields: [leadNotes.authorId],
        references: [users.id],
    }),
}));

export const usersRelations = relations(users, ({ many }) => ({
    assignedLeads: many(leads),
    authoredNotes: many(leadNotes),
    agencyProjects: many(agencyProjects),
    assignedTasks: many(tasks),
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
export const taskStatusEnum = pgEnum("task_status", ["Todo", "In Progress", "Blocked", "Done"]);

export const agencyProjects = pgTable("agency_project", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description"),
    clientId: text("clientId")
        .notNull()
        .references(() => users.id, { onDelete: "restrict" }),
    leadId: text("leadId")
        .references(() => leads.id, { onDelete: "set null" }), // Link back to originating lead
    status: agencyProjectStatusEnum("status").default("Kickoff").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    targetDate: timestamp("target_date", { mode: "date" }),
    stagingUrls: text("staging_urls").array(), // For Figma/Live links
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
    assigneeId: text("assigneeId")
        .references(() => users.id, { onDelete: "set null" }), // Staff assigned
    dueDate: timestamp("due_date", { mode: "date" }),
    status: taskStatusEnum("status").default("Todo").notNull(),
    isBlockedByClient: boolean("is_blocked_by_client").default(false).notNull(),
    overdueNotified: boolean("overdue_notified").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    status: feedbackStatusEnum("status").notNull(),
    commentText: text("comment_text"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PM Relations
export const agencyProjectsRelations = relations(agencyProjects, ({ one, many }) => ({
    client: one(users, {
        fields: [agencyProjects.clientId],
        references: [users.id],
    }),
    lead: one(leads, {
        fields: [agencyProjects.leadId],
        references: [leads.id],
    }),
    milestones: many(milestones),
    tasks: many(tasks),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
    project: one(agencyProjects, {
        fields: [milestones.projectId],
        references: [agencyProjects.id],
    }),
    tasks: many(tasks),
    feedback: many(clientFeedback),
}));

export const clientFeedbackRelations = relations(clientFeedback, ({ one }) => ({
    milestone: one(milestones, {
        fields: [clientFeedback.milestoneId],
        references: [milestones.id],
    }),
    client: one(users, {
        fields: [clientFeedback.clientId],
        references: [users.id],
    }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
    project: one(agencyProjects, {
        fields: [tasks.projectId],
        references: [agencyProjects.id],
    }),
    milestone: one(milestones, {
        fields: [tasks.milestoneId],
        references: [milestones.id],
    }),
    assignee: one(users, {
        fields: [tasks.assigneeId],
        references: [users.id],
    }),
}));
