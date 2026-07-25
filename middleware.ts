import NextAuth from "next-auth"
import authConfig from "@/auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;
    const role = (req.auth?.user as any)?.role;

    const isAdminRoute =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/admin");

    const isClientRoute =
        nextUrl.pathname.startsWith("/portal") ||
        nextUrl.pathname.startsWith("/proposal");

    const isProtectedRoute = isAdminRoute || isClientRoute;

    // 1. Redirect unauthenticated users trying to access protected routes
    if (isProtectedRoute && !isLoggedIn) {
        return Response.redirect(new URL("/services?login=required", nextUrl));
    }

    // 2. RBAC checks for authenticated users
    if (isLoggedIn) {
        if (isAdminRoute && role !== "admin" && role !== "editor") {
            // Non-admin users trying to access admin routes
            return Response.redirect(new URL("/portal", nextUrl));
        }
    }

    // 3. Allow everything else (Public by default)
    return;
});

// Configure which paths middleware runs on
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
