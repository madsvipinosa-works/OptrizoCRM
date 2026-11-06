import { cookies } from "next/headers";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { SIDEBAR_COOKIE } from "@/components/admin/sidebar-cookie";

import { auth } from "@/auth";

export default async function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();
    // Open or collapsed is remembered in a cookie so the first paint already has the right width.
    const sidebarExpanded = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "collapsed";

    return (
        <RoleGuard allowedRoles={["superadmin", "sales", "manager", "developer", "content_editor"]}>
            <div className="flex min-h-screen bg-background text-foreground w-full overflow-x-hidden relative">
                {/* Bento ambient grid mask matching Hero page */}
                <div className="pointer-events-none fixed inset-0 bento-mask opacity-25 dark:opacity-15 z-0" />

                <AdminShell user={session?.user} initialExpanded={sidebarExpanded}>
                    {children}
                </AdminShell>
            </div>
        </RoleGuard>
    );
}
