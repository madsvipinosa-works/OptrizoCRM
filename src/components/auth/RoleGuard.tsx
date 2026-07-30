import { auth, hasRole } from "@/auth";
import { redirect } from "next/navigation";

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

export async function RoleGuard({ children, allowedRoles = ["superadmin"] }: RoleGuardProps) {
    const session = await auth();

    if (!session || !session.user) {
        redirect("/api/auth/signin");
    }

    if (!hasRole(session, allowedRoles)) {
        redirect("/");
    }

    return <>{children}</>;
}
