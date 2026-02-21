import { RoleGuard } from "@/components/auth/RoleGuard";
import { auth } from "@/auth";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function ClientPortalLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();

    return (
        <RoleGuard allowedRoles={["client", "admin", "editor"]}>
            <div className="flex flex-col min-h-screen bg-black">
                {/* Header Navbar */}
                <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur supports-[backdrop-filter]:bg-black/20">
                    <div className="container flex h-16 max-w-7xl items-center justify-between mx-auto px-4">
                        <div className="flex items-center gap-4">
                            <Link href="/portal" className="flex items-center space-x-2">
                                <span className="font-bold text-xl text-glow-sm">OPTRIZO</span>
                                <span className="text-muted-foreground hidden sm:inline-block border-l border-white/20 pl-2 ml-2">Client Portal</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground hidden sm:inline-block">
                                Hello, {session?.user?.name?.split(' ')[0]}
                            </span>
                            <Avatar className="h-8 w-8 border border-white/10">
                                <AvatarImage src={session?.user?.image || ""} />
                                <AvatarFallback className="bg-primary/20 text-primary">
                                    {session?.user?.name?.[0] || <User className="h-4 w-4" />}
                                </AvatarFallback>
                            </Avatar>
                            <Button variant="ghost" size="icon" asChild title="Sign Out">
                                <Link href="/api/auth/signout">
                                    <LogOut className="h-4 w-4 text-muted-foreground hover:text-white" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
        </RoleGuard>
    );
}
