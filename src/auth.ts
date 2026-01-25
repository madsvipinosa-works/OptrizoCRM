import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: DrizzleAdapter(db),
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session.user && user) {
                session.user.id = user.id;

                // Force fetch role from DB to avoid adapter issues
                const dbUser = await db.query.users.findFirst({
                    where: eq(users.id, user.id),
                });

                session.user.role = dbUser?.role || "user";

                console.log(`[Auth] Session User: ${user.email}, Role from DB: ${session.user.role}`);
            }
            return session;
        },
    },
})
