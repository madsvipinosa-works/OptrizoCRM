import NextAuth from "next-auth"
import authConfig from "@/auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;
    let role = (req.auth?.user as any)?.role || "client";

    // Graceful fallback for existing JWT sessions after 6-tier migration
    if (role === "admin") role = "superadmin";
    if (role === "editor") role = "content_editor";
    if (role === "user") role = "client";

    const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");
    const isClientRoute = nextUrl.pathname.startsWith("/portal") || nextUrl.pathname.startsWith("/proposal");
    const isProtectedRoute = isDashboardRoute || isClientRoute;

    // 1. Redirect unauthenticated users
    if (isProtectedRoute && !isLoggedIn) {
        return Response.redirect(new URL("/services?login=required", nextUrl));
    }

    // 2. Strict RBAC Firewalls for authenticated users
    if (isLoggedIn) {
        // --- Dashboard Routes Firewall ---
        if (isDashboardRoute) {
            // Superadmin has God Mode, bypass checks.
            if (role === "superadmin") return;

            // Clients should NEVER be in the dashboard
            if (role === "client") {
                return Response.redirect(new URL("/portal", nextUrl));
            }

            // Route matching
            const isCrmRoute = nextUrl.pathname.startsWith("/dashboard/analytics") || nextUrl.pathname.startsWith("/dashboard/leads") || nextUrl.pathname.startsWith("/dashboard/inquiries") || nextUrl.pathname.startsWith("/dashboard/contacts");
            const isPmRoute = nextUrl.pathname.startsWith("/dashboard/pm");
            const isCmsRoute = nextUrl.pathname.startsWith("/dashboard/cms");
            const isSystemRoute = nextUrl.pathname.startsWith("/dashboard/settings") || nextUrl.pathname.startsWith("/dashboard/team") || nextUrl.pathname.startsWith("/dashboard/audit");

            // Role constraints
            if (role === "sales") {
                if (!isCrmRoute) return Response.redirect(new URL("/dashboard/analytics", nextUrl));
            } else if (role === "manager" || role === "developer") {
                if (!isPmRoute) return Response.redirect(new URL("/dashboard/pm", nextUrl));
            } else if (role === "content_editor") {
                if (!isCmsRoute) return Response.redirect(new URL("/dashboard/cms", nextUrl));
            } else {
                // Unknown dashboard role? Kick to portal just in case.
                return Response.redirect(new URL("/portal", nextUrl));
            }
        }
    }

    // 3. Allow everything else (Public by default)
    return;
});

// Configure which paths middleware runs on
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
