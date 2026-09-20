import { RoleGuard } from "@/components/auth/RoleGuard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

import { auth } from "@/auth";

export default async function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();
    const userRole = session?.user?.role || "user";

    return (
        <RoleGuard allowedRoles={["superadmin", "sales", "manager", "developer", "content_editor"]}>
            <div className="flex min-h-screen bg-background text-foreground w-full overflow-x-hidden relative">
                {/* Bento ambient grid mask matching Hero page */}
                <div className="pointer-events-none fixed inset-0 bento-mask opacity-25 dark:opacity-15 z-0" />
                
                <AdminSidebar user={session?.user} />
                <main className="flex-1 md:ml-64 pt-24 md:pt-8 px-4 sm:px-8 pb-8 min-h-screen min-w-0 max-w-full overflow-x-hidden relative z-10">
                    {children}
                </main>
            </div>
        </RoleGuard>
    );
}
