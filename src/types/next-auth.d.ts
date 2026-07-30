import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            role: "superadmin" | "sales" | "manager" | "developer" | "content_editor" | "client";
            jobTitle?: string | null;
        } & DefaultSession["user"];
    }

    interface User {
        role?: "superadmin" | "sales" | "manager" | "developer" | "content_editor" | "client";
        jobTitle?: string | null;
    }
}

declare module "@auth/core/adapters" {
    interface AdapterUser {
        role?: "superadmin" | "sales" | "manager" | "developer" | "content_editor" | "client";
        jobTitle?: string | null;
    }
}
