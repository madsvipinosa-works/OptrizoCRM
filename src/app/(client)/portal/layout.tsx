import { RoleGuard } from "@/components/auth/RoleGuard";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TimezoneSync } from "@/features/client-portal/components/TimezoneSync";

/** The client's saved timezone. Null if not set yet or the column is missing, so the portal still loads. */
async function storedTimezone(): Promise<string | null> {
    try {
        const session = await auth();
        if (!session?.user?.id) return null;
        const [row] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, session.user.id)).limit(1);
        return row?.tz ?? null;
    } catch {
        return null;
    }
}

export default async function ClientPortalLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const stored = await storedTimezone();
    return (
        <RoleGuard allowedRoles={["client"]}>
            <TimezoneSync stored={stored} />
            {children}
        </RoleGuard>
    );
}
