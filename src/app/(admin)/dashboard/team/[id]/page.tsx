import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { UserActiveToggle } from "@/features/cms/team/components/UserActiveToggle";
import { UserRoleSelect } from "@/features/cms/team/components/UserRoleSelect";
import { JobTitleEditor } from "@/features/cms/team/components/JobTitleEditor";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  sales: "Sales",
  manager: "Project Manager",
  developer: "Developer",
  content_editor: "Content Editor",
  client: "Client",
};

function formatLockTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authz = await requireRole(["superadmin"]);
  if (!authz.ok) {
    return redirect("/dashboard");
  }
  const currentUserId = authz.session.user?.id || "";

  const resolvedParams = await params;
  const parsedId = uuidSchema.safeParse(resolvedParams?.id);
  if (!parsedId.success) {
    return notFound();
  }

  const user = await db.query.users.findFirst({
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
      jobTitle: true,
      lockedUntil: true,
      deletedAt: true,
    },
    where: eq(users.id, parsedId.data),
  });

  if (!user || user.deletedAt) {
    return notFound();
  }

  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const canChangeRole =
    user.role !== "superadmin" &&
    user.role !== "client" &&
    user.id !== currentUserId;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href="/dashboard/team"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0e6b7e] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to users
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex flex-wrap items-center gap-3">
            <span>{user.name || user.email}</span>
            <span className="text-sm font-semibold px-3 py-0.5 rounded-full bg-muted text-foreground border border-border">
              {roleLabel}
            </span>
          </h2>
          <p className="text-muted-foreground mt-1">{roleLabel} account</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5 items-stretch">
        <div className="rounded-xl border border-border bg-card p-6 space-y-1">
          <h3 className="text-lg font-bold text-foreground mb-3">Account</h3>

          <div className="grid grid-cols-[130px_1fr] gap-3 items-center py-2.5 border-b border-border text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium text-foreground">
              {user.name || "—"}
            </span>
          </div>

          <div className="grid grid-cols-[130px_1fr] gap-3 items-center py-2.5 border-b border-border text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground break-all">
              {user.email}
            </span>
          </div>

          <div className="grid grid-cols-[130px_1fr] gap-3 items-center py-2.5 border-b border-border text-sm">
            <span className="text-muted-foreground">Role</span>
            <div className="flex items-center gap-3">
              {canChangeRole ? (
                <UserRoleSelect
                  userId={user.id}
                  currentRole={user.role}
                  currentUserId={currentUserId}
                />
              ) : (
                <span className="font-medium text-foreground">{roleLabel}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] gap-3 items-center py-2.5 border-b border-border text-sm">
            <span className="text-muted-foreground">Job title</span>
            <div>
              {user.role !== "client" ? (
                <JobTitleEditor
                  userId={user.id}
                  currentTitle={user.jobTitle}
                  isAdmin={true}
                />
              ) : (
                <span className="text-muted-foreground">
                  {user.jobTitle || "—"}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] gap-3 items-center py-2.5 border-b border-border text-sm">
            <span className="text-muted-foreground">Status</span>
            <div className="flex flex-wrap items-center gap-2.5">
              <UserActiveToggle
                userId={user.id}
                status={user.status}
                isActive={user.isActive}
                isAdmin={false}
                userName={user.name || user.email}
                userRole={user.role}
              />
              {user.status === "locked" && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {user.lockedUntil
                    ? `Locked until ${formatLockTime(new Date(user.lockedUntil))}`
                    : "Manual lock"}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] gap-3 items-center py-2.5 border-b border-border text-sm">
            <span className="text-muted-foreground">Created</span>
            <span className="text-muted-foreground">Not tracked</span>
          </div>

          <div className="grid grid-cols-[130px_1fr] gap-3 items-center py-2.5 text-sm">
            <span className="text-muted-foreground">Last sign-in</span>
            <span className="text-muted-foreground">Not tracked</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground">Manage access</h3>
            <p className="text-sm text-muted-foreground">
              Change account status or manage pending invitations for this
              account.
            </p>
            <div className="pt-2">
              <UserActiveToggle
                userId={user.id}
                status={user.status}
                isActive={user.isActive}
                isAdmin={true}
                userName={user.name || user.email}
                userRole={user.role}
                mode="full"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            Deactivating blocks sign-in. History stays in the audit log.
          </p>
        </div>
      </div>
    </div>
  );
}

