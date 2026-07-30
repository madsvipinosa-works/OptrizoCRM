import type { NextAuthConfig } from "next-auth"

// Notice this is only an export object, not the full NextAuth() instantiation.
// This file does NOT contain the DrizzleAdapter or any database queries, allowing it to run on the Edge.
export default {
    providers: [], // Empty array for Edge middleware compatibility
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.jobTitle = (user as any).jobTitle;
            }
            return token;
        },
        session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string;
                let role = (token.role as string) || "client";
                
                // Graceful fallback for existing JWT sessions
                if (role === "admin") role = "superadmin";
                if (role === "editor") role = "content_editor";
                if (role === "user") role = "client";

                (session.user as any).role = role;
                (session.user as any).jobTitle = token.jobTitle as string;
            }
            return session;
        }
    }
} satisfies NextAuthConfig
