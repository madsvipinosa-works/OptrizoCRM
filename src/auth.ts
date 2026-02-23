import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import authConfig from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: DrizzleAdapter(db),
    session: { strategy: "jwt" },
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            // Auto-link OAuth accounts to existing emails
            if (account?.provider === "google" && user.email) {
                const existingUser = await db.query.users.findFirst({
                    where: eq(users.email, user.email),
                });

                if (existingUser) {
                    // Update the user.id so the DrizzleAdapter links the account correctly
                    user.id = existingUser.id;
                }
            }
            return true;
        },
        async jwt({ token, user }) {
            // User object is only available on initial sign-in
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token?.id) {
                session.user.id = token.id as string;

                // Force fetch role from DB to avoid JWT staleness
                const dbUser = await db.query.users.findFirst({
                    where: eq(users.id, session.user.id),
                });

                session.user.role = dbUser?.role || "user";

                console.log(`[Auth] Session User: ${session.user.email}, Role from DB: ${session.user.role}`);
            }
            return session;
        },
    },
})
