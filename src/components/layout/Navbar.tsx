import { auth, signOut } from "@/auth";
import { getSiteSettings } from "@/features/cms/actions";
import { Header } from "@/components/blocks/header-2";

export async function Navbar() {
    const session = await auth();
    const isAdmin = session?.user?.role === "admin";
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
