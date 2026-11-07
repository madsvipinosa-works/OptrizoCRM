import { cookies } from "next/headers";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { SIDEBAR_COOKIE } from "@/components/admin/sidebar-cookie";

import { auth } from "@/auth";
import { getSiteSettings } from "@/features/cms/actions";

export default async function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Site settings are cached (1h), so the logo adds no real wait; both run together.
    const [session, settings] = await Promise.all([auth(), getSiteSettings()]);
    // Open or collapsed is remembered in a cookie so the first paint already has the right width.
    const sidebarExpanded = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "collapsed";

    return (
        <RoleGuard allowedRoles={["superadmin", "sales", "manager", "developer", "content_editor"]}>
            <div className="flex min-h-screen bg-background text-foreground w-full overflow-x-hidden relative">

                <AdminShell user={session?.user} initialExpanded={sidebarExpanded} logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl}>
                    {children}
                </AdminShell>
            </div>
        </RoleGuard>
    );
}
