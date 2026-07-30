import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import authConfig from "./auth.config"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
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
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const email = credentials.email as string;
                const password = credentials.password as string;

                // Fetch user from DB
                const user = await db.query.users.findFirst({
                    where: eq(users.email, email)
                });

                // Fail if user missing or user doesn't have a hashed password (e.g. Google-only account)
                if (!user || !user.password) {
                    return null;
                }
                
                if (!user.isActive) {
                    throw new Error("Account deactivated. Please contact an administrator.");
                }

                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                } as any;
            }
        })
    ],
    callbacks: {
        async signIn({ user, account }) {
            // Auto-link OAuth accounts to existing emails
            if (account?.provider === "google" && user.email) {
                const existingUser = await db.query.users.findFirst({
                    where: eq(users.email, user.email),
                });

                if (existingUser && !existingUser.isActive) {
                    throw new Error("Account deactivated. Please contact an administrator.");
                }

                if (existingUser) {
                    // Update the user.id so the DrizzleAdapter links the account correctly
                    user.id = existingUser.id;
                    (user as any).role = existingUser.role;
                    (user as any).jobTitle = existingUser.jobTitle;
                }
            }
            return true;
        },
        async jwt({ token, user }) {
            // User object is only available on initial sign-in
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.jobTitle = (user as any).jobTitle;
            }
            // Fetch fresh user data from DB to reflect role changes in Supabase/DB immediately
            if (token.email) {
                try {
                    const dbUser = await db.query.users.findFirst({
                        where: eq(users.email, token.email),
                    });
                    if (dbUser) {
                        token.id = dbUser.id;
                        token.role = dbUser.role;
                        token.jobTitle = dbUser.jobTitle;
                    }
                } catch (e) {
                    console.error("[Auth] DB lookup error in JWT callback:", e);
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token?.id) {
                session.user.id = token.id as string;
                let role = (token.role as string) || "client";
                
                // Graceful fallback for existing JWT sessions after 6-tier migration
                if (role === "admin") role = "superadmin";
                if (role === "editor") role = "content_editor";
                if (role === "user") role = "client";

                session.user.role = role as any;
                session.user.jobTitle = (token.jobTitle as string) || null;
            }
            return session;
        },
    },
})

import type { Session } from "next-auth";

export function hasRole(session: Session | null, allowedRoles: string[]): session is Session & { user: { role: string, id: string, email: string, name: string } } {
    const role = (session?.user as any)?.role;
    return !!(role && allowedRoles.includes(role));
}

export function requireRole(session: Session | null, allowedRoles: string[]): asserts session is Session & { user: { role: string, id: string, email: string, name: string } } {
    if (!hasRole(session, allowedRoles)) {
        throw new Error("Unauthorized");
    }
}
