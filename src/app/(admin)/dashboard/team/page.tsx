import { db } from "@/db";
import { requireRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { UserActiveToggle } from "@/features/cms/team/components/UserActiveToggle";
import { UserPlus, Search } from "lucide-react";
import { auditLogs, users } from "@/db/schema";
import { ilike, or, and, eq, isNull, max } from "drizzle-orm";
import { format } from "date-fns";
import { FormSelect } from "@/components/ui/form-select";

export const dynamic = "force-dynamic";

const VALID_ROLES = [
  "superadmin",
  "sales",
  "manager",
  "developer",
  "content_editor",
  "client",
] as const;

const VALID_STATUSES = ["invited", "active", "locked", "deactivated"] as const;

type ValidRole = (typeof VALID_ROLES)[number];
type ValidStatus = (typeof VALID_STATUSES)[number];

const ROLE_LABELS: Record<ValidRole, string> = {
  superadmin: "Super Admin",
  sales: "Sales",
  manager: "Project Manager",
  developer: "Developer",
  content_editor: "Content Editor",
  client: "Client",
};

interface TeamPageSearchParams {
  q?: string;
  role?: string;
  status?: string;
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<TeamPageSearchParams>;
}) {
  const authz = await requireRole(["superadmin"]);
  if (!authz.ok) {
    return redirect("/dashboard");
  }
  const session = authz.session;
  const currentUserId = session.user?.id || "";

  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q.trim() : "";

  const roleFilter: ValidRole | undefined =
    typeof params?.role === "string" &&
    (VALID_ROLES as readonly string[]).includes(params.role)
      ? (params.role as ValidRole)
      : undefined;

  const statusFilter: ValidStatus | undefined =
    typeof params?.status === "string" &&
    (VALID_STATUSES as readonly string[]).includes(params.status)
      ? (params.status as ValidStatus)
      : undefined;

  const searchFilter = query
    ? or(ilike(users.name, `%${query}%`), ilike(users.email, `%${query}%`))
    : undefined;

  const accountRows = await db.query.users.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
      jobTitle: true,
      deletedAt: true,
    },
    where: and(
      isNull(users.deletedAt),
      roleFilter ? eq(users.role, roleFilter) : undefined,
      statusFilter ? eq(users.status, statusFilter) : undefined,
      searchFilter
    ),
    limit: 100,
    orderBy: (u, { asc }) => [asc(u.name), asc(u.email)],
  });

  // Last sign-in comes from the audit log (one LOGIN row per sign-in).
  const lastSignIns = await db
    .select({ userId: auditLogs.userId, last: max(auditLogs.createdAt) })
    .from(auditLogs)
    .where(eq(auditLogs.action, "LOGIN"))
    .groupBy(auditLogs.userId);
  const lastByUser = new Map(lastSignIns.map((r) => [r.userId, r.last]));

  const hasFilters = Boolean(query || roleFilter || statusFilter);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Users
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Staff and client accounts. Clients create their own; staff accounts
            are created here.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/team/new">
            <UserPlus className="size-4" aria-hidden="true" />
            Add staff account
          </Link>
        </Button>
      </div>

      <AutoFilterForm className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search name or email"
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <FormSelect
          name="role"
          defaultValue={roleFilter ?? ""}
          aria-label="Filter by role"
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
         variant="plain">
          <option value="">All roles</option>
          <option value="sales">Sales</option>
          <option value="manager">Project Manager</option>
          <option value="developer">Developer</option>
          <option value="content_editor">Content Editor</option>
          <option value="client">Client</option>
          <option value="superadmin">Super Admin</option>
        </FormSelect>

        <FormSelect
          name="status"
          defaultValue={statusFilter ?? ""}
          aria-label="Filter by status"
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
         variant="plain">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="locked">Locked</option>
          <option value="invited">Invited</option>
          <option value="deactivated">Deactivated</option>
        </FormSelect>


        {hasFilters && (
          <Link
            href="/dashboard/team"
            className="text-sm font-medium text-muted-foreground hover:text-foreground px-2"
          >
            Clear
          </Link>
        )}
      </AutoFilterForm>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-medium">
              <tr>
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Last sign-in</th>
                              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accountRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 px-4 text-center text-muted-foreground"
                  >
                    No accounts match. Clear the search or filters to see everyone.
                  </td>
                </tr>
              ) : (
                accountRows.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/team/${user.id}`}
                          className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {user.name || user.email}
                        </Link>
                        {user.id === currentUserId && (
                          <Badge
                            variant="secondary"
                            className="h-5 text-xs"
                          >
                            You
                          </Badge>
                        )}
                      </div>
                      {user.jobTitle && (
                        <div className="text-sm font-normal text-muted-foreground">
                          {user.jobTitle}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground truncate max-w-[260px]">
                      {user.email}
                    </td>
                    <td className="py-2.5 px-4 text-foreground whitespace-nowrap">
                      {ROLE_LABELS[user.role] || user.role}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <UserActiveToggle
                        userId={user.id}
                        status={user.status}
                        isActive={user.isActive}
                        isAdmin={true}
                        userName={user.name || user.email}
                        userRole={user.role}
                        mode="invite-only"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap tabular-nums">
                      {lastByUser.get(user.id) ? format(lastByUser.get(user.id)!, "MMM d, h:mm a") : "No record"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
          <span>
            Showing {accountRows.length}{" "}
            {accountRows.length === 1 ? "account" : "accounts"} (max 100)
          </span>
        </div>
      </div>
    </div>
  );
}
