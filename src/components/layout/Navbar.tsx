import { auth, signOut, hasRole } from "@/auth";
import { getSiteSettings } from "@/features/cms/actions";
import { Header } from "@/components/blocks/header-2";

export async function Navbar() {
    let session = null;
    try {
        session = await auth();
    } catch (error) {
        console.warn("[Navbar] Invalid/stale session token encountered, falling back to guest mode:", error);
    }
    const isAdmin = hasRole(session, ["superadmin", "sales", "manager", "developer", "content_editor"]);
    const settings = await getSiteSettings();

    const navLinks = [
        { href: "/services", label: "Services" },
        { href: "/projects", label: "Projects" },
        { href: "/about", label: "About" },
        { href: "/blog", label: "Blog" },
    ];

    const handleSignOut = async () => {
        "use server";
        await signOut({ redirectTo: "/" });
    };

    return (
        <Header
            session={session}
            isAdmin={isAdmin}
            settings={settings || null}
            navLinks={navLinks}
            onSignOut={handleSignOut}
        />
    );
}
