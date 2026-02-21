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
export const roleEnum = pgEnum("role", ["user", "admin", "editor"]);

// 2. Users Table (Extended for RBAC)
export const users = pgTable("user", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    role: roleEnum("role").default("user").notNull(),
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
    (verificationToken) => [
        primaryKey({
            columns: [verificationToken.identifier, verificationToken.token],
        }),
    ]
);

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
});

// 11. Contact Messages (Lead Capture)
// 11. Leads (CRM Core)
export const leadEnum = pgEnum("lead_status", ["New", "Contacted", "In Progress", "Completed", "Lost"]);
export const activityEnum = pgEnum("activity_type", ["Call", "Email", "Meeting", "Note"]);

export const leads = pgTable("lead", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject"),
    message: text("message").notNull(),
    status: leadEnum("status").default("New").notNull(),
    score: integer("score").default(0),
    budget: text("budget"), // e.g., "$1k - $5k"
    service: text("service"), // e.g., "Web Development"
    source: text("source").default("Website Form"),
    notes: text("notes"), // Legacy simple notes (keeping for backward compatibility)
    assignedTo: text("assignedTo").references(() => users.id), // New: Assignment
    files: text("files").array(), // Array of file URLs (e.g., Proposals)
    nextActionDate: timestamp("next_action_date", { mode: "date" }), // Scheduled follow-up
    read: boolean("read").default(false).notNull(),
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

// --- RELATIONS ---
import { relations } from "drizzle-orm";

export const leadsRelations = relations(leads, ({ one, many }) => ({
    notesList: many(leadNotes), // Changed name to avoid conflict with 'notes' column
    assignee: one(users, {
        fields: [leads.assignedTo],
        references: [users.id],
    }),
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
}));
