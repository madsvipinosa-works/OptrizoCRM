import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { z } from "zod";

const webhookPayloadSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    source: z.string().optional().default("Webhook"),
    service: z.string().optional(),
    budget: z.string().optional(),
    notes: z.string().optional(),
});

function isValidBearer(header: string | null, secret: string): boolean {
    if (!header) return false;
    const given = Buffer.from(header);
    const expected = Buffer.from(`Bearer ${secret}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: Request) {
    try {
        // No fallback secret: a missing WEBHOOK_SECRET must never leave the endpoint open or guessable.
        const secret = process.env.WEBHOOK_SECRET;
        if (!secret) {
            console.error("[Webhook] WEBHOOK_SECRET is not set; rejecting all requests.");
            return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
        }

        if (!isValidBearer(req.headers.get("Authorization"), secret)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validated = webhookPayloadSchema.safeParse(body);

        if (!validated.success) {
            return NextResponse.json({ 
                error: "Invalid payload", 
                details: validated.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const data = validated.data;

        await db.insert(inquiries).values({
            name: data.name,
            email: data.email,
            subject: data.service || "Webhook Inquiry",
            message: data.notes || "Webhook Intake",
            source: data.source,
            status: "Unread",
        });

        return NextResponse.json({ success: true, message: "Lead inquiry created." }, { status: 201 });
    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
