import { RoleGuard } from "@/components/auth/RoleGuard";

export default function ClientPortalLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <RoleGuard allowedRoles={["client", "superadmin", "sales", "manager", "developer", "content_editor"]}>
            {children}
        </RoleGuard>
    );
}
