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
    ];

    return (
        <Header
            settings={settings || null}
            navLinks={navLinks}
            authSlot={
                <Suspense key="auth-desktop" fallback={<NavbarAuthFallback settings={settings} />}>
                    <NavbarAuthDesktop settings={settings} />
                </Suspense>
            }
            mobileBellSlot={
                <Suspense key="mobile-bell" fallback={null}>
                    <NavbarMobileBell />
                </Suspense>
            }
            mobileAuthSlot={
                <Suspense key="auth-mobile" fallback={<NavbarAuthFallback mobile settings={settings} />}>
                    <NavbarAuthMobile settings={settings} />
                </Suspense>
            }
        />
    );
}
