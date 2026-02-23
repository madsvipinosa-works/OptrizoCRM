import type { NextAuthConfig } from "next-auth"

// Notice this is only an export object, not the full NextAuth() instantiation.
// This file does NOT contain the DrizzleAdapter or any database queries, allowing it to run on the Edge.
export default {
    providers: [], // Empty array for Edge middleware compatibility
} satisfies NextAuthConfig
