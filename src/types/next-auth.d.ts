import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            role: "admin" | "user" | "editor";
        } & DefaultSession["user"];
    }

    interface User {
        role?: "admin" | "user" | "editor";
    }
}

declare module "@auth/core/adapters" {
    interface AdapterUser {
        role?: "admin" | "user" | "editor";
    }
}
