import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";

export async function GET() {
    const tasksWithLinks = await db.query.tasks.findMany({
        where: isNotNull(tasks.proofNotes),
        limit: 10
    });
    return NextResponse.json({ tasks: tasksWithLinks });
}
