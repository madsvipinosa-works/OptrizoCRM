import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    // Backdoor disabled by default. Only enable explicitly during controlled development.
    if (process.env.ALLOW_MAKE_ME_ADMIN !== "true") {
        return new Response("Forbidden: Promotion endpoint disabled.", { status: 403 });
    }

    if (process.env.NODE_ENV === "production") {
        return new Response("Forbidden: Promotion disabled in production.", { status: 403 });
    }

    try {
        // 1. Get the first user
        const allUsers = await db.select().from(users).limit(1);

        if (allUsers.length === 0) {
            return NextResponse.json({ error: "No users found. Please sign in first!" }, { status: 400 });
        }

        const user = allUsers[0];

        // 2. Update role to admin
        await db.update(users)
            .set({ role: "admin" })
            .where(eq(users.id, user.id));

        return NextResponse.json({
            success: true,
            message: `User ${user.email} has been promoted to ADMIN.`,
            nextStep: "Go to http://localhost:3000/dashboard"
        });

    } catch (error) {
        return NextResponse.json({ error: "Failed to update user", details: error }, { status: 500 });
    }
}
