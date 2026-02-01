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
                <main className="flex-1 md:ml-64 p-8 bg-zinc-950/50">
                    {children}
                </main>
            </div>
        </RoleGuard>
    );
}
