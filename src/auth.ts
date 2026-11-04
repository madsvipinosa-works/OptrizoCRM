import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { users } from "@/db/schema"
import { and, eq, isNotNull, lte, sql } from "drizzle-orm"
import authConfig from "./auth.config"
import bcrypt from "bcryptjs"
import { headers as nextHeaders } from "next/headers"
import {
    checkRateLimit,
    formatRetryAfter,
    getClientIp,
    normalizeEmail,
    RateLimitError,
    resetRateLimit,
} from "@/lib/rate-limit"
import type { Session } from "next-auth"
import { canSignIn, isSessionValid } from "@/lib/account-status"
import { logAction } from "@/features/audit/log"

async function resolveClientIp(request: Request | undefined): Promise<string | null> {
    const fromRequest = getClientIp(request?.headers);
    if (fromRequest) return fromRequest;
    try {
        return getClientIp(await nextHeaders());
    } catch {
        return null;
    }
}

export async function authorizeUser(credentials: Record<string, unknown> | undefined, request?: Request) {
    if (!credentials?.email || !credentials?.password) return null;

    const email = credentials.email as string;
    const password = credentials.password as string;
    const emailKey = normalizeEmail(email);

    // --- Brute-force / DoS guard: runs BEFORE the DB query and bcrypt.compare ---
    const ip = await resolveClientIp(request);
    if (ip) {
        const ipCheck = await checkRateLimit("loginIp", ip);
        if (!ipCheck.success) {
            console.warn(`[Security] Login rate limit (IP) hit: ip=${ip}`);
            throw new RateLimitError(
                `Too many login attempts from your network. Please try again in ${formatRetryAfter(ipCheck.retryAfterSeconds)}.`,
                ipCheck.retryAfterSeconds,
            );
        }
    }
    const emailCheck = await checkRateLimit("loginEmail", emailKey);
    if (!emailCheck.success) {
        console.warn(`[Security] Login rate limit (account) hit: email=${emailKey} ip=${ip ?? "unknown"}`);
        throw new RateLimitError(
            `Too many login attempts for this account. Please try again in ${formatRetryAfter(emailCheck.retryAfterSeconds)}.`,
            emailCheck.retryAfterSeconds,
        );
    }

    // Fetch user from DB
    const user = await db.query.users.findFirst({
        where: eq(users.email, email)
    });

    // Fail if user missing, soft-deleted, or doesn't have a hashed password (e.g. Google-only account)
    if (!user || user.deletedAt || !user.password) {
        return null;
    }

    // Run bcrypt.compare FIRST: wrong password returns null immediately without revealing account status
    const isValid = await bcrypt.compare(password, user.password);

    // Expired auto-lock: if status === 'locked' && lockedUntil !== null && lockedUntil <= now(), clear atomically
    if (user.status === "locked" && user.lockedUntil !== null && new Date(user.lockedUntil) <= new Date()) {
        const [cleared] = await db
            .update(users)
            .set({
                status: "active",
                failedLogins: 0,
                lockedUntil: null,
                isActive: true,
            })
            .where(
                and(
                    eq(users.id, user.id),
                    eq(users.status, "locked"),
                    isNotNull(users.lockedUntil),
                    lte(users.lockedUntil, sql`now()`)
                )
            )
            .returning({
                id: users.id,
                status: users.status,
                failedLogins: users.failedLogins,
                lockedUntil: users.lockedUntil,
                isActive: users.isActive,
            });

        if (cleared) {
            user.status = "active";
            user.failedLogins = 0;
            user.lockedUntil = null;
            user.isActive = true;
        }
    }

    if (!isValid) {
        // Count failure ONLY if user exists, has a password, and status is 'active' (after expired auto-lock check)
        if (user.status === "active") {
            const [updated] = await db
                .update(users)
                .set({
                    failedLogins: sql`${users.failedLogins} + 1`,
                    status: sql`CASE WHEN ${users.failedLogins} + 1 >= 5 THEN 'locked'::account_status ELSE ${users.status} END`,
                    lockedUntil: sql`CASE WHEN ${users.failedLogins} + 1 >= 5 THEN now() + interval '15 minutes' ELSE ${users.lockedUntil} END`,
                })
                .where(and(eq(users.id, user.id), eq(users.status, "active")))
                .returning({
                    id: users.id,
                    status: users.status,
                    failedLogins: users.failedLogins,
                    lockedUntil: users.lockedUntil,
                });

            if (updated?.status === "locked") {
                try {
                    await logAction("UPDATE", "user", "auto-lock after 5 failed sign-ins", user.id);
                } catch (auditErr) {
                    console.error("Failed to log auto-lock action:", auditErr);
                }
            }
        }
        return null;
    }

    if (!canSignIn(user)) {
        if (!user.isActive || user.status === "deactivated") {
            throw new Error("Account deactivated. Please contact an administrator.");
        }

        if (user.status === "invited") {
            throw new Error("Please verify your email address before signing in.");
        }

        if (user.status === "locked") {
            throw new Error("Account is locked. Please try again later or contact your administrator.");
        }

        return null;
    }

    // Reset failedLogins if > 0 on successful login
    if (user.status === "active" && (user.failedLogins ?? 0) > 0) {
        await db
            .update(users)
            .set({ failedLogins: 0 })
            .where(and(eq(users.id, user.id), eq(users.status, "active")));
    }

    // Successful login clears the per-account counter (the IP counter keeps running).
    await resetRateLimit("loginEmail", emailKey);

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    trustHost: true,
    adapter: DrizzleAdapter(db),
    session: { strategy: "jwt" },
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            authorize: authorizeUser,
        })
    ],
    callbacks: {
        async signIn({ user, account }) {
            // Auto-link OAuth accounts to existing emails
            if (account?.provider === "google" && user.email) {
                const existingUser = await db.query.users.findFirst({
                    where: eq(users.email, user.email),
                });

                if (existingUser) {
                    if (!canSignIn(existingUser)) {
                        if (!existingUser.isActive || existingUser.status === "deactivated") {
                            throw new Error("Account deactivated. Please contact an administrator.");
                        }
                        if (existingUser.status === "invited") {
                            throw new Error("Please verify your email address before signing in.");
                        }
                        if (existingUser.status === "locked") {
                            throw new Error("Account is locked. Please try again later or contact your administrator.");
                        }
                        return false;
                    }

                    // Update the user.id so the DrizzleAdapter links the account correctly
                    user.id = existingUser.id;
                    user.role = existingUser.role;
                    user.jobTitle = existingUser.jobTitle;
                }
            }
            return true;
        },
        async jwt({ token, user }) {
            // User object is only available on initial sign-in
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.jobTitle = user.jobTitle;
            }

            if (token.id || token.email) {
                try {
                    const [dbUser] = await db
                        .select({
                            id: users.id,
                            name: users.name,
                            role: users.role,
                            status: users.status,
                            jobTitle: users.jobTitle,
                            isActive: users.isActive,
                            deletedAt: users.deletedAt,
                            lockedUntil: users.lockedUntil,
                        })
                        .from(users)
                        .where(
                            token.id
                                ? eq(users.id, token.id as string)
                                : eq(users.email, token.email as string)
                        )
                        .limit(1);

                    if (!dbUser || !isSessionValid(dbUser)) {
                        token.invalidated = true;
                        delete token.id;
                        delete token.role;
                        delete token.email;
                        return null;
                    }

                    token.invalidated = false;
                    token.id = dbUser.id;
                    token.name = dbUser.name;
                    token.role = dbUser.role;
                    token.jobTitle = dbUser.jobTitle;
                } catch (e: unknown) {
                    const err = e as (Error & { cause?: { message?: string } }) | null;
                    console.warn("[Auth] DB lookup skipped in JWT callback (session preserved):", err?.cause?.message || err?.message || String(e));
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (!token || token.invalidated || !token.id) {
                return null as unknown as Session;
            }
            if (session.user && token?.id) {
                session.user.id = token.id as string;
                session.user.name = (token.name as string) ?? session.user.name;
                let role = (token.role as string) || "client";
                
                // Graceful fallback for existing JWT sessions after 6-tier migration
                if (role === "admin") role = "superadmin";
                if (role === "editor") role = "content_editor";
                if (role === "user") role = "client";

                session.user.role = role as Session["user"]["role"];
                session.user.jobTitle = (token.jobTitle as string) || null;
            }
            return session;
        },
    },
})

export function hasRole(session: Session | null, allowedRoles: string[]): session is Session & { user: { role: string, id: string, email: string, name: string } } {
    const role = session?.user?.role;
    return !!(role && allowedRoles.includes(role));
}

export function requireRole(session: Session | null, allowedRoles: string[]): asserts session is Session & { user: { role: string, id: string, email: string, name: string } } {
    if (!hasRole(session, allowedRoles)) {
        throw new Error("Unauthorized");
    }
}
