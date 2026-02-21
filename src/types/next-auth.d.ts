import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            role: "admin" | "user" | "editor" | "client";
        } & DefaultSession["user"];
    }

    interface User {
        role?: "admin" | "user" | "editor" | "client";
    }
}

declare module "@auth/core/adapters" {
    interface AdapterUser {
        role?: "admin" | "user" | "editor" | "client";
    }
}
