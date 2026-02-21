import { auth } from "@/auth";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;

    const isProtectedRoute =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/admin") ||
        nextUrl.pathname.startsWith("/portal");

    // 1. Redirect unauthenticated users trying to access protected routes
    if (isProtectedRoute && !isLoggedIn) {
        return Response.redirect(new URL("/api/auth/signin", nextUrl));
    }

    // 2. Allow everything else (Public by default)
    return;
});

// Configure which paths middleware runs on
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
