import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ClientNavbar } from "@/features/client-portal/components/ClientNavbar";
import { getSiteSettings } from "@/features/cms/actions";

/** Client portal shell (mockup 089): its own top bar, no public navbar, no sidebar, no animated background. */
export default async function ClientLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();
    const [profile, settings] = await Promise.all([
        session?.user?.id ? db.query.users.findFirst({ where: eq(users.id, session.user.id), columns: { name: true, companyName: true } }) : null,
        getSiteSettings(),
    ]);

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground print:bg-transparent">
            {session?.user && (
                <ClientNavbar name={profile?.name || session.user.name || session.user.email || "Client"} company={profile?.companyName} email={session.user.email} logoUrl={settings?.logoUrl} logoDarkUrl={settings?.logoDarkUrl} />
            )}
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 md:px-6 md:pb-12 md:pt-8 print:m-0 print:p-0">{children}</main>
        </div>
    );
}
