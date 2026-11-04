import "server-only";

import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";

export type ProjectActivityCursor = {
  createdAt: string | Date;
  id: string;
};

export type GetProjectActivityOptions = {
  limit?: number;
  before?: ProjectActivityCursor | string | null;
};

export type ProjectActivityItem = {
  id: string;
  projectId: string | null;
  action: string;
  entity: string;
  details: string;
  createdAt: Date;
  user: {
    name: string | null;
    role: string | null;
  } | null;
};

export type ProjectActivityResult = {
  items: ProjectActivityItem[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Encodes a `{ createdAt, id }` cursor into a URL-safe string `"<iso>|<id>"`.
 */
export function encodeActivityCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

/**
 * Parses either a `{ createdAt, id }` object or an encoded `"<iso>|<id>"` (or ISO timestamp) string.
 */
export function parseActivityCursor(
  before?: ProjectActivityCursor | string | null,
): { createdAt: Date; id: string | null } | null {
  if (!before) return null;

  if (typeof before === "object") {
    const dt =
      before.createdAt instanceof Date
        ? before.createdAt
        : new Date(before.createdAt);
    if (Number.isNaN(dt.getTime())) return null;
    const id = typeof before.id === "string" && before.id.trim() ? before.id.trim() : null;
    return { createdAt: dt, id };
  }

  if (typeof before === "string") {
    const trimmed = before.trim();
    if (!trimmed) return null;
    const pipeIdx = trimmed.indexOf("|");
    if (pipeIdx > 0) {
      const iso = trimmed.slice(0, pipeIdx);
      const id = trimmed.slice(pipeIdx + 1).trim();
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return null;
      return { createdAt: dt, id: id || null };
    }
    const dt = new Date(trimmed);
    if (Number.isNaN(dt.getTime())) return null;
    return { createdAt: dt, id: null };
  }

  return null;
}

/**
 * Sanitizes audit log details for safe display:
 * - Strips internal `[actorRole:...]` prefix tags.
 * - Redacts email addresses of third parties.
 * - Redacts hex hashes (32+ hex chars), JWTs, and token/secret values.
 */
export function sanitizeActivityDetails(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\[actorRole:[^\]]+\]\s*/gi, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
    .replace(/\b[a-f0-9]{32,128}\b/gi, "[redacted-hash]")
    .replace(
      /\b(token|secret|password|hash)\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .trim();
}

const ENTITY_DISPLAY_LABELS: Record<string, string> = {
  project: "Project",
  "project details": "Project Details",
  "project resources": "Project Resources",
  "project document": "Project Document",
  document: "Handover Document",
  "client document": "Client Document",
  task: "Task",
  milestone: "Milestone",
  sprint: "Sprint",
  payment: "Payment",
  project_team_member: "Team Member",
  feedback: "Project Feedback",
};

const KNOWN_ACTION_LABELS: Record<string, string> = {
  plan_sprint: "Planned Sprint",
  move_task_to_sprint: "Moved Task to Sprint",
  sprint_end: "Sprint Ended",
  start_task: "Started Task",
  submit_task: "Submitted Task",
  approve_task: "Approved Task",
  request_task_changes: "Requested Task Changes",
  create_task: "Created Task",
  update_task_details: "Updated Task Details",
  delete_task: "Deleted Task",
  mark_empty_milestone_done: "Completed Empty Milestone",
  upload_payment_proof: "Uploaded Payment Proof",
  confirm_payment: "Confirmed Payment",
  reject_payment_proof: "Rejected Payment Proof",
  add_handover_file: "Added Handover Document",
  record_sign_off: "Recorded Client Sign-Off",
  complete_project: "Completed Project",
  submit_project_feedback: "Submitted Project Feedback",
  add_project_team_member: "Added Team Member",
  remove_project_team_member: "Removed Team Member",
  update_project_details: "Updated Project Details",
  update_project_status: "Updated Project Status",
  update_project_settings: "Updated Project Resources",
  add_project_document: "Added Project Document",
  delete_project_document: "Deleted Project Document",
  archive_project: "Archived Project",
  unarchive_project: "Unarchived Project",
};

function normalizeEntityLabel(rawEntity: string): string {
  const trimmed = rawEntity.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (ENTITY_DISPLAY_LABELS[lower]) {
    return ENTITY_DISPLAY_LABELS[lower];
  }
  return trimmed.replace(/_/g, " ");
}

/**
 * Formats an audit action and entity into a readable human label.
 * Unknown actions fall back to the raw action string.
 */
export function formatActivityActionLabel(action: string, entity?: string | null): string {
  const cleanEntity = normalizeEntityLabel(entity || "");
  switch (action) {
    case "CREATE":
      if (cleanEntity === "Team Member") return "Added Team Member";
      return cleanEntity ? `Created ${cleanEntity}` : "Created";
    case "UPDATE":
      return cleanEntity ? `Updated ${cleanEntity}` : "Updated";
    case "DELETE":
      if (cleanEntity === "Team Member") return "Removed Team Member";
      return cleanEntity ? `Deleted ${cleanEntity}` : "Deleted";
    case "LOGIN":
      return "Signed in";
    case "OTHER":
      return cleanEntity ? `${cleanEntity} activity` : "Other";
    default: {
      const normalizedKey = action
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toLowerCase();
      if (KNOWN_ACTION_LABELS[normalizedKey]) {
        return KNOWN_ACTION_LABELS[normalizedKey];
      }
      return action;
    }
  }
}

/**
 * Loads audit_log rows for a specific project (`WHERE project_id = projectId`), newest first,
 * left-joined to `user` for display `name` and `role` ONLY (never `password`, `email`, or any other user column).
 *
 * - Caps `limit` at 100 (defaults to 50).
 * - Supports cursor pagination via `before` (`created_at, id`).
 *
 * NOTE: This query performs NO authorization check itself.
 * Callers MUST verify `requireRole(["manager"]).ok` and `authorizeProject(projectId, "read").ok` first.
 */
export async function getProjectActivity(
  projectId: string,
  options: GetProjectActivityOptions = {},
): Promise<ProjectActivityResult> {
  if (!projectId) {
    return { items: [], nextCursor: null };
  }

  const requestedLimit =
    typeof options.limit === "number" && Number.isFinite(options.limit)
      ? Math.floor(options.limit)
      : DEFAULT_LIMIT;
  const clampedLimit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);

  const parsedCursor = parseActivityCursor(options.before);

  const cursorCondition = parsedCursor
    ? parsedCursor.id
      ? or(
          lt(auditLogs.createdAt, parsedCursor.createdAt),
          and(
            eq(auditLogs.createdAt, parsedCursor.createdAt),
            lt(auditLogs.id, parsedCursor.id),
          ),
        )
      : lt(auditLogs.createdAt, parsedCursor.createdAt)
    : undefined;

  const whereClause = cursorCondition
    ? and(eq(auditLogs.projectId, projectId), cursorCondition)
    : eq(auditLogs.projectId, projectId);

  // Explicit columns ONLY: never select password, email, or any other user column
  const rows = await db
    .select({
      id: auditLogs.id,
      projectId: auditLogs.projectId,
      action: auditLogs.action,
      entity: auditLogs.entity,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userRole: users.role,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(clampedLimit);

  // Defensive post-filter ensuring only rows for this projectId are returned and only name & role on user
  const filteredRows = rows.filter((r) => r.projectId === projectId).slice(0, clampedLimit);

  const items: ProjectActivityItem[] = filteredRows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    action: row.action,
    entity: row.entity,
    details: sanitizeActivityDetails(row.details),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    user:
      row.userName !== null || row.userRole !== null
        ? {
            name: row.userName ?? null,
            role: row.userRole ?? null,
          }
        : null,
  }));

  const lastItem = items.length === clampedLimit ? items[items.length - 1] : undefined;
  const nextCursor = lastItem
    ? encodeActivityCursor(lastItem.createdAt, lastItem.id)
    : null;

  return {
    items,
    nextCursor,
  };
}

