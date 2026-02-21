import { auth } from "@/auth";
import { redirect } from "next/navigation";

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles?: ("admin" | "editor" | "user" | "client")[];
}

export async function RoleGuard({ children, allowedRoles = ["admin"] }: RoleGuardProps) {
    const session = await auth();

    if (!session || !session.user) {
        redirect("/api/auth/signin");
    }

    const userRole = session.user.role;

    if (!allowedRoles.includes(userRole)) {
        redirect("/");
    }

    return <>{children}</>;
}
