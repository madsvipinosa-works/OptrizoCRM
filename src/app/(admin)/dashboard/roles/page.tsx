import { requireRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import {
  ROLE_COLUMN_ORDER,
  ROLE_PERMISSION_MATRIX,
  ROLE_DEFINITIONS,
  type PermissionAccessLevel,
} from "@/config/role-permissions";

export const dynamic = "force-dynamic";

function renderAccessBadge(level: PermissionAccessLevel) {
  if (level === "Edit") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e0f0f3] text-[#0e6b7e] dark:bg-[#0e6b7e]/20 dark:text-[#5cc8dc] whitespace-nowrap">
        Edit
      </span>
    );
  }

  if (level === "View") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border whitespace-nowrap">
        View
      </span>
    );
  }

  if (level === "View + export") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
          View
        </span>
        <span className="text-xs text-muted-foreground">+ export</span>
      </span>
    );
  }

  if (level === "Own only") {
    return (
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        Own only
      </span>
    );
  }

  return <span className="text-muted-foreground select-none">—</span>;
}

export default async function RolesPage() {
  const authz = await requireRole(["superadmin"]);
  if (!authz.ok) {
    return redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Roles
        </h2>
        <p className="text-muted-foreground mt-1">
          What each role can do in the system.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-sm text-foreground">
        <span className="inline-flex items-center gap-2">
          {renderAccessBadge("Edit")}
          <span>Can change it</span>
        </span>
        <span className="inline-flex items-center gap-2">
          {renderAccessBadge("View")}
          <span>Can only look</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <strong className="font-semibold">Own only</strong>
          <span className="text-muted-foreground">Just their own items</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="text-muted-foreground">—</span>
          <span className="text-muted-foreground">No access</span>
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
              <tr>
                <th className="py-2.5 px-4 min-w-[180px]">Area</th>
                {ROLE_COLUMN_ORDER.map((col) => (
                  <th
                    key={col.role}
                    className="py-2.5 px-4 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROLE_PERMISSION_MATRIX.map((row) => (
                <tr
                  key={row.area}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-foreground">
                    <div>{row.area}</div>
                    {row.note && (
                      <div className="text-xs font-normal text-muted-foreground mt-0.5">
                        {row.note}
                      </div>
                    )}
                  </td>
                  {ROLE_COLUMN_ORDER.map((col) => (
                    <td key={col.role} className="py-3 px-4">
                      {renderAccessBadge(row.permissions[col.role])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-[#e0f0f3] dark:bg-[#0e6b7e]/15 border border-[#0e6b7e]/20 px-4 py-3 text-sm text-[#0b4f5d] dark:text-[#bce8f1]">
        <strong className="font-semibold">
          Super Admin stays out of the work.
        </strong>{" "}
        It manages accounts and reads analytics, reports and the audit log. It
        cannot open leads, proposals, projects or payments.
      </div>

      <p className="text-sm text-muted-foreground">
        Roles are fixed. You choose which role an account has, from the user’s
        page. “Own only” means they see just their own items: a client sees
        only their own proposals and payments, a developer only the tasks
        assigned to them.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {ROLE_DEFINITIONS.map((def) => (
          <div
            key={def.role}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-foreground">
                {def.label}
              </h3>
              <span className="text-xs text-muted-foreground">
                {def.landsOn}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{def.summary}</p>
            <div className="space-y-1.5 text-xs">
              <div className="font-semibold text-foreground">Can do:</div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {def.canDo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="font-semibold text-foreground">Cannot do:</div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {def.cannotDo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

