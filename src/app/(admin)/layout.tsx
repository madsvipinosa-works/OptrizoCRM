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
        <RoleGuard allowedRoles={["admin", "editor"]}>
            <div className="flex min-h-screen bg-black">
                <AdminSidebar userRole={userRole} />
                <main className="flex-1 md:ml-64 pt-24 md:pt-8 px-4 sm:px-8 pb-8 bg-zinc-950/50 min-h-screen">
                    {children}
                </main>
            </div>
        </RoleGuard>
    );
}
