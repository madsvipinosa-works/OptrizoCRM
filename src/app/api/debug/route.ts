import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET() {
    const tasks = await db.query.tasks.findMany({ limit: 5 });
    return NextResponse.json({ tasks });
}
