import { auth } from "@/auth";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
    const isPublicRoute =
        req.nextUrl.pathname === "/" ||
        req.nextUrl.pathname.startsWith("/about") ||
        req.nextUrl.pathname.startsWith("/services") ||
        req.nextUrl.pathname.startsWith("/contact") ||
        req.nextUrl.pathname.startsWith("/projects") ||
        req.nextUrl.pathname.startsWith("/blog");

    // Allow all auth API routes
    if (isAuthRoute) return;

    // Protect private routes (like /admin or /dashboard)
    if (!isLoggedIn && !isPublicRoute) {
        return Response.redirect(new URL("/api/auth/signin", req.nextUrl));
    }

    // Allow public routes
    return;
});

// Configure which paths middleware runs on
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
