export type SystemRole =
  | "sales"
  | "manager"
  | "developer"
  | "content_editor"
  | "client"
  | "superadmin";

export type PermissionAccessLevel =
  | "Edit"
  | "View"
  | "View + export"
  | "Own only"
  | "—";

export interface RoleDefinition {
  role: SystemRole;
  label: string;
  landsOn: string;
  summary: string;
  canDo: readonly string[];
  cannotDo: readonly string[];
}

export interface RolePermissionAreaRow {
  area: string;
  permissions: Record<SystemRole, PermissionAccessLevel>;
  note?: string;
}

export const ROLE_COLUMN_ORDER: readonly {
  role: SystemRole;
  label: string;
}[] = [
  { role: "sales", label: "Sales" },
  { role: "manager", label: "Project Manager" },
  { role: "developer", label: "Developer" },
  { role: "content_editor", label: "Content Editor" },
  { role: "client", label: "Client" },
  { role: "superadmin", label: "Super Admin" },
];

/**
 * Permission matrix derived from docs/workflow-spec.md §1 and mockup 106.
 * Note: Spec §1 and §10 explicitly define Project Manager access on "Leads and pipeline" as "—" (no access),
 * overriding mockup 106 which showed "View".
 */
export const ROLE_PERMISSION_MATRIX: readonly RolePermissionAreaRow[] = [
  {
    area: "Leads and pipeline",
    permissions: {
      sales: "Edit",
      manager: "—",
      developer: "—",
      content_editor: "—",
      client: "—",
      superadmin: "—",
    },
  },
  {
    area: "Meetings",
    permissions: {
      sales: "Edit",
      manager: "Edit",
      developer: "—",
      content_editor: "—",
      client: "Own only",
      superadmin: "—",
    },
    note: "Sales edits discovery meetings and views the rest; Project Manager edits budget & pricing, project review, and UAT meetings and views discovery.",
  },
  {
    area: "Proposals",
    permissions: {
      sales: "View",
      manager: "Edit",
      developer: "—",
      content_editor: "—",
      client: "Own only",
      superadmin: "—",
    },
  },
  {
    area: "Projects and tasks",
    permissions: {
      sales: "—",
      manager: "Edit",
      developer: "Own only",
      content_editor: "—",
      client: "Own only",
      superadmin: "—",
    },
    note: "Developers act only on tasks assigned to them and can view all tasks in projects they are a team member of (read-only). Clients view progress on their own projects only.",
  },
  {
    area: "Payments",
    permissions: {
      sales: "—",
      manager: "Edit",
      developer: "—",
      content_editor: "—",
      client: "Own only",
      superadmin: "—",
    },
  },
  {
    area: "Website content",
    permissions: {
      sales: "—",
      manager: "—",
      developer: "—",
      content_editor: "Edit",
      client: "—",
      superadmin: "—",
    },
  },
  {
    area: "Analytics and reports",
    permissions: {
      sales: "Own only",
      manager: "Own only",
      developer: "—",
      content_editor: "—",
      client: "—",
      superadmin: "View + export",
    },
    note: "For Sales and Project Manager, 'Own only' refers to the summary strip on their own dashboard.",
  },
  {
    area: "Users and roles",
    permissions: {
      sales: "—",
      manager: "—",
      developer: "—",
      content_editor: "—",
      client: "—",
      superadmin: "Edit",
    },
  },
  {
    area: "Audit log",
    permissions: {
      sales: "—",
      manager: "—",
      developer: "—",
      content_editor: "—",
      client: "—",
      superadmin: "View",
    },
  },
];

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    role: "sales",
    label: "Sales",
    landsOn: "Sales dashboard (/dashboard)",
    summary:
      "Owns leads and discovery. Moves leads from inquiry to proposal request and views proposals read-only.",
    canDo: [
      "Claim unassigned leads, contact leads, and log interactions",
      "Book and complete discovery meetings",
      "Fill in and submit the discovery form and request a proposal",
      "Reopen or archive a closed-lost lead",
      "View proposals (read-only) and view non-discovery meetings",
    ],
    cannotDo: [
      "Create, edit, price, or send proposals",
      "Open or manage projects, milestones, sprints, tasks, or payments",
      "Edit website content or manage user accounts and roles",
    ],
  },
  {
    role: "manager",
    label: "Project Manager",
    landsOn: "PM dashboard (/dashboard)",
    summary:
      "Owns proposals, pricing, projects, tasks, payments, and project completion.",
    canDo: [
      "Draft, price, and send proposal versions and log outside discussions",
      "Book and manage budget & pricing, project review, and UAT meetings (and view discovery meetings)",
      "Manage projects, milestones, team members, backlog, sprints, and Gantt schedule",
      "Review developer task submissions (approve or request changes)",
      "Confirm or reject payment proofs and record project completion sign-off",
    ],
    cannotDo: [
      "Access leads or the sales pipeline",
      "Edit public website content",
      "Manage user accounts, roles, or system-wide audit logs",
    ],
  },
  {
    role: "developer",
    label: "Developer",
    landsOn: "My tasks (/dashboard/my-tasks)",
    summary:
      "Executes assigned project tasks and views tasks within their own assigned projects.",
    canDo: [
      "Start, submit work for, and fix tasks assigned to them",
      "View all tasks read-only in projects where they are a project team member",
    ],
    cannotDo: [
      "Modify tasks assigned to other developers or approve tasks",
      "Access projects they are not assigned to",
      "Access leads, meetings, proposals, payments, website content, or user administration",
    ],
  },
  {
    role: "content_editor",
    label: "Content Editor",
    landsOn: "Website content (/dashboard/cms)",
    summary:
      "Manages public website content (services, portfolio, and marketing pages) with no CRM access.",
    canDo: [
      "Create, edit, publish, and hide public website services and portfolio items",
      "Edit and publish Home, About, and Contact page content",
    ],
    cannotDo: [
      "Access leads, meetings, proposals, projects, tasks, or payments",
      "Manage user accounts, roles, analytics, or audit logs",
    ],
  },
  {
    role: "client",
    label: "Client",
    landsOn: "Client portal home (/portal)",
    summary:
      "Uses the Client Portal to review their own proposals, meetings, projects, payments, and documents.",
    canDo: [
      "View their own proposals, request pricing meetings or changes, decline, or sign",
      "Confirm, reschedule, or decline their own meeting invites",
      "View progress on their own projects, download documents/handover files, and submit project feedback",
      "View their own payment schedule and upload payment proof",
    ],
    cannotDo: [
      "See any other client's proposals, projects, meetings, payments, or documents",
      "Approve project milestones or access staff dashboard routes",
    ],
  },
  {
    role: "superadmin",
    label: "Super Admin",
    landsOn: "Super Admin dashboard (/dashboard)",
    summary:
      "Oversees and monitors only. Manages accounts and roles, and reads analytics, reports, and the audit log.",
    canDo: [
      "Invite staff accounts (Sales, Project Manager, Developer, Content Editor)",
      "Change staff roles and lock, unlock, deactivate, or reactivate accounts",
      "View the roles permission matrix and the system audit log",
      "View and export aggregate analytics and reports (counts and totals only)",
    ],
    cannotDo: [
      "Participate in any operational workflow",
      "Open, create, edit, or delete leads, meetings, proposals, projects, tasks, or payments",
      "Edit public website content",
    ],
  },
];

