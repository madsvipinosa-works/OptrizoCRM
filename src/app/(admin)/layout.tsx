import { RoleGuard } from "@/components/auth/RoleGuard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <RoleGuard allowedRoles={["admin"]}>
            <div className="flex min-h-screen bg-black">
                <AdminSidebar />
                <main className="flex-1 md:ml-64 p-8 bg-zinc-950/50" data-aos="fade-up">
                    {children}
                </main>
            </div>
        </RoleGuard>
    );
}
