import { Suspense } from "react";
import { getSiteSettings } from "@/features/cms/actions";
import { Header } from "@/components/blocks/header-2";
import {
    NavbarAuthDesktop,
    NavbarAuthMobile,
    NavbarMobileBell,
    NavbarAuthFallback,
} from "./NavbarAuth";

export async function Navbar() {
    const settings = await getSiteSettings();

    const navLinks = [
        { href: "/services", label: "Services" },
        { href: "/projects", label: "Projects" },
        { href: "/about", label: "About" },
        { href: "/blog", label: "Blog" },
    ];

    return (
        <Header
            settings={settings || null}
            navLinks={navLinks}
            authSlot={
                <Suspense fallback={<NavbarAuthFallback settings={settings} />}>
                    <NavbarAuthDesktop settings={settings} />
                </Suspense>
            }
            mobileBellSlot={
                <Suspense fallback={null}>
                    <NavbarMobileBell />
                </Suspense>
            }
            mobileAuthSlot={
                <Suspense fallback={<NavbarAuthFallback mobile settings={settings} />}>
                    <NavbarAuthMobile settings={settings} />
                </Suspense>
            }
        />
    );
}
