import { db } from "@/db";
import { requireRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { UserActiveToggle } from "@/features/cms/team/components/UserActiveToggle";
import { UserPlus, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { auditLogs, users } from "@/db/schema";
import { ilike, or, and, eq, isNull, max, count } from "drizzle-orm";
import { format } from "date-fns";
import { FormSelect } from "@/components/ui/form-select";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

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
  page?: string;
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

  const where = and(
    isNull(users.deletedAt),
    roleFilter ? eq(users.role, roleFilter) : undefined,
    statusFilter ? eq(users.status, statusFilter) : undefined,
    searchFilter
  );
  const [countRow] = await db.select({ total: count() }).from(users).where(where);
  const total = Number(countRow?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt(typeof params?.page === "string" ? params.page : "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;

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
    where,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
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
  // Page links keep the current filters.
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (roleFilter) sp.set("role", roleFilter);
    if (statusFilter) sp.set("status", statusFilter);
    if (n > 1) sp.set("page", String(n));
    const qs = sp.toString();
    return qs ? `/dashboard/team?${qs}` : "/dashboard/team";
  };
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, total);

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
        <div className="relative w-full sm:w-80">
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
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48"
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
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48"
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
          {/* Fixed layout so the five columns share the width evenly instead of sizing to their content. */}
          <table className="w-full min-w-[760px] table-fixed text-sm text-left">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[28%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
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
                    <td className="py-3 px-4 font-semibold text-foreground">
                      <div className="flex min-w-0 items-center gap-2">
                        <Link
                          href={`/dashboard/team/${user.id}`}
                          className="truncate rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
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
                        <div className="truncate text-sm font-normal text-muted-foreground">
                          {user.jobTitle}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground truncate" title={user.email}>
                      {user.email}
                    </td>
                    <td className="py-3 px-4 text-foreground truncate">
                      {ROLE_LABELS[user.role] || user.role}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
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
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap tabular-nums">
                      {lastByUser.get(user.id) ? format(lastByUser.get(user.id)!, "MMM d, h:mm a") : "No record"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {total === 0 ? "No accounts" : `Showing ${firstShown}–${lastShown} of ${total} ${total === 1 ? "account" : "accounts"}`}
          </span>
          <nav aria-label="Pages" className="flex items-center gap-1.5">
            {page <= 1 ? (
              <span aria-disabled="true" className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground/50"><ChevronsLeft className="size-4" aria-hidden="true" /><span className="sr-only">First page</span></span>
            ) : (
              <Link href={pageHref(1)} aria-label="First page" className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><ChevronsLeft className="size-4" aria-hidden="true" /></Link>
            )}
            {page <= 1 ? (
              <span aria-disabled="true" className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground/50"><ChevronLeft className="size-4" aria-hidden="true" /><span className="sr-only">Previous page</span></span>
            ) : (
              <Link href={pageHref(page - 1)} aria-label="Previous page" className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="size-4" aria-hidden="true" /></Link>
            )}
            <span className="min-w-20 px-2 text-center tabular-nums text-foreground" aria-current="page">
              {page} of {pageCount}
            </span>
            {page >= pageCount ? (
              <span aria-disabled="true" className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground/50"><ChevronRight className="size-4" aria-hidden="true" /><span className="sr-only">Next page</span></span>
            ) : (
              <Link href={pageHref(page + 1)} aria-label="Next page" className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="size-4" aria-hidden="true" /></Link>
            )}
            {page >= pageCount ? (
              <span aria-disabled="true" className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground/50"><ChevronsRight className="size-4" aria-hidden="true" /><span className="sr-only">Last page</span></span>
            ) : (
              <Link href={pageHref(pageCount)} aria-label="Last page" className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><ChevronsRight className="size-4" aria-hidden="true" /></Link>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
