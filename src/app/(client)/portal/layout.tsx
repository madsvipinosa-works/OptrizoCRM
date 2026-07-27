import { RoleGuard } from "@/components/auth/RoleGuard";

export default function ClientPortalLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <RoleGuard allowedRoles={["client", "admin", "editor"]}>
            {children}
        </RoleGuard>
    );
}
