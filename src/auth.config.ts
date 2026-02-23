import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

// Notice this is only an export object, not the full NextAuth() instantiation.
// This file does NOT contain the DrizzleAdapter or any database queries, allowing it to run on the Edge.
export default {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
    ],
} satisfies NextAuthConfig
