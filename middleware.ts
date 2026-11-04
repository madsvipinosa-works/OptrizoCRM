import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

function getLandingPage(role: string): string {
  switch (role) {
    case "sales":
    case "manager":
      return "/dashboard";
    case "developer":
      return "/dashboard/my-tasks";
    case "content_editor":
      return "/dashboard/cms";
    case "superadmin":
      return "/dashboard/analytics";
    case "client":
    default:
      return "/portal";
  }
}

function isAllowedOnDashboardPath(pathname: string, role: string): boolean {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  if (cleanPath === "/dashboard") {
    return role === "sales" || role === "manager";
  }

  if (cleanPath === "/dashboard/leads" || cleanPath.startsWith("/dashboard/leads/")) {
    return role === "sales";
  }

  if (
    cleanPath === "/dashboard/inquiries" ||
    cleanPath.startsWith("/dashboard/inquiries/") ||
    cleanPath === "/dashboard/contacts" ||
    cleanPath.startsWith("/dashboard/contacts/")
  ) {
    return role === "sales";
  }

  if (cleanPath.startsWith("/dashboard/proposals/builder")) {
    return role === "manager";
  }

  if (cleanPath === "/dashboard/proposals" || cleanPath.startsWith("/dashboard/proposals/")) {
    return role === "sales" || role === "manager";
  }

  if (cleanPath === "/dashboard/meetings" || cleanPath.startsWith("/dashboard/meetings/")) {
    return role === "sales" || role === "manager";
  }

  if (
    cleanPath === "/dashboard/my-tasks" ||
    cleanPath.startsWith("/dashboard/my-tasks/") ||
    cleanPath === "/dashboard/dev" ||
    cleanPath.startsWith("/dashboard/dev/")
  ) {
    return role === "developer" || role === "manager";
  }

  if (cleanPath === "/dashboard/pm" || cleanPath.startsWith("/dashboard/pm/")) {
    return role === "manager" || role === "developer";
  }

  if (
    cleanPath === "/dashboard/cms" ||
    cleanPath.startsWith("/dashboard/cms/") ||
    cleanPath === "/dashboard/services" ||
    cleanPath.startsWith("/dashboard/services/") ||
    cleanPath === "/dashboard/portfolio" ||
    cleanPath.startsWith("/dashboard/portfolio/") ||
    cleanPath === "/dashboard/posts" ||
    cleanPath.startsWith("/dashboard/posts/") ||
    cleanPath === "/dashboard/testimonials" ||
    cleanPath.startsWith("/dashboard/testimonials/") ||
    cleanPath === "/dashboard/about" ||
    cleanPath.startsWith("/dashboard/about/")
  ) {
    return role === "content_editor";
  }

  if (
    cleanPath === "/dashboard/analytics" ||
    cleanPath.startsWith("/dashboard/analytics/") ||
    cleanPath === "/dashboard/team" ||
    cleanPath.startsWith("/dashboard/team/") ||
    cleanPath === "/dashboard/roles" ||
    cleanPath.startsWith("/dashboard/roles/") ||
    cleanPath === "/dashboard/audit" ||
    cleanPath.startsWith("/dashboard/audit/") ||
    cleanPath === "/dashboard/settings" ||
    cleanPath.startsWith("/dashboard/settings/")
  ) {
    return role === "superadmin";
  }

  return false;
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;
  let role = (req.auth?.user as { role?: string } | undefined)?.role || "client";

  // Graceful fallback for legacy role strings
  if (role === "admin") role = "superadmin";
  if (role === "editor") role = "content_editor";
  if (role === "user") role = "client";

  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");
  const isClientRoute =
    nextUrl.pathname.startsWith("/portal") || nextUrl.pathname.startsWith("/proposal");
  const isProtectedRoute = isDashboardRoute || isClientRoute;

  // 1. Redirect unauthenticated users
  if (isProtectedRoute && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return Response.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  // 2. Enforce permissions table and landing pages for authenticated users
  if (isLoggedIn) {
    const landingPage = getLandingPage(role);

    // /portal and /proposal: client only, no staff fallback
    if (isClientRoute) {
      if (role !== "client") {
        return Response.redirect(new URL(landingPage, nextUrl));
      }
      return;
    }

    // /dashboard routes: enforce role permissions table
    if (isDashboardRoute) {
      if (!isAllowedOnDashboardPath(nextUrl.pathname, role)) {
        return Response.redirect(new URL(landingPage, nextUrl));
      }
      return;
    }
  }

  return;
});

// Configure which paths middleware runs on - only protected application routes
export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/proposal/:path*"],
};
