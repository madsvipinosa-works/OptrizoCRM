import Link from "next/link";
// Force Recompile
import { Menu, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

import { auth, signOut } from "@/auth";
import { LoginModal } from "@/components/auth/LoginModal";

import { getSiteSettings } from "@/features/cms/actions";
import Image from "next/image";

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

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center px-4">
                {/* 1. Logo (Left) */}
                <div className="flex-1 flex justify-start">
                    <Link href="/" className="flex items-center space-x-2 group">
                        {settings?.logoUrl ? (
                            <div className="relative h-10 w-32">
                                <Image
                                    src={settings.logoUrl}
                                    alt="Logo"
                                    fill
                                    className="object-contain object-left"
                                />
                            </div>
                        ) : (
                            <>
                                <div className="h-8 w-8 bg-primary rounded-sm flex items-center justify-center transition-transform group-hover:scale-110">
                                    <Code2 className="h-5 w-5 text-black" />
                                </div>
                                <span className="text-xl font-bold font-mono tracking-tighter decoration-primary decoration-2 underline-offset-4 group-hover:underline">
                                    OPTRIZO
                                </span>
                            </>
                        )}
                    </Link>
                </div>

                {/* 2. Navigation Links (Center) */}
                <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-muted-foreground hover:text-primary transition-colors hover:text-glow "
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* 3. Global Actions / Auth (Right) */}
                <div className="flex-1 flex justify-end items-center gap-4">
                    {/* Desktop Auth */}
                    <div className="hidden md:flex items-center gap-4">
                        {session ? (
                            <>
                                {isAdmin && (
                                    <Button asChild variant="secondary" className="font-bold border border-primary/20 hover:bg-primary/10 hover:text-primary">
                                        <Link href="/dashboard">Dashboard</Link>
                                    </Button>
                                )}
                                <form
                                    action={async () => {
                                        "use server"
                                        await signOut()
                                    }}
                                >
                                    <Button type="submit" variant="ghost" className="text-muted-foreground hover:text-red-500">
                                        Sign Out
                                    </Button>
                                </form>
                            </>
                        ) : (
                            <>
                                <LoginModal>
                                    <Button variant="ghost" className="text-muted-foreground hover:text-primary">
                                        Login
                                    </Button>
                                </LoginModal>
                                <Button asChild className="bg-primary text-black font-bold hover:bg-primary/90 hover:box-glow transition-all">
                                    <Link href="/contact">Get Started</Link>
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Trigger */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="border-l border-white/10 bg-black/95 backdrop-blur-xl">
                            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                            <div className="flex flex-col space-y-6 mt-8">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="text-2xl font-bold text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                                {session ? (
                                    <>
                                        {isAdmin && (
                                            <Button asChild size="lg" variant="secondary">
                                                <Link href="/dashboard">Dashboard</Link>
                                            </Button>
                                        )}
                                        <form
                                            action={async () => {
                                                "use server"
                                                await signOut()
                                            }}
                                            className="w-full"
                                        >
                                            <Button type="submit" size="lg" variant="outline" className="w-full text-red-500 hover:text-red-400 hover:bg-red-950/20 border-red-900/50">
                                                Sign Out
                                            </Button>
                                        </form>
                                    </>
                                ) : (
                                    <>
                                        <LoginModal>
                                            <Button size="lg" variant="outline" className="w-full">
                                                Login
                                            </Button>
                                        </LoginModal>
                                        <Button asChild size="lg" className="bg-primary text-black font-bold mt-4">
                                            <Link href="/contact">Start Project</Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
