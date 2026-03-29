import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            role: "admin" | "user" | "editor" | "client";
            jobTitle?: string | null;
        } & DefaultSession["user"];
    }

    interface User {
        role?: "admin" | "user" | "editor" | "client";
        jobTitle?: string | null;
    }
}

declare module "@auth/core/adapters" {
    interface AdapterUser {
        role?: "admin" | "user" | "editor" | "client";
        jobTitle?: string | null;
    }
}
