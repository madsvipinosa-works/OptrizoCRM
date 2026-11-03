import "server-only";

import crypto from "crypto";
import { db } from "@/db";
import { verificationTokens, leads, agencyProjects, projectStakeholders } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Creates a single-use email verification token valid for 24 hours.
 * Cleans up any prior tokens for the same email address.
 */
export async function createVerificationToken(email: string): Promise<string> {
    const normalizedEmail = email.trim().toLowerCase();

    // Delete existing verification tokens for this email
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, normalizedEmail));

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(verificationTokens).values({
        identifier: normalizedEmail,
        token,
        expires,
    });

    return token;
}

/**
 * Consumes and deletes an email verification token.
 * Validates expiration and single-use guarantee.
 */
export async function consumeVerificationToken(
    token: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
    if (!token || typeof token !== "string") {
        return { ok: false, error: "Invalid verification link." };
    }

    const record = await db.query.verificationTokens.findFirst({
        where: eq(verificationTokens.token, token.trim()),
    });

    if (!record) {
        return { ok: false, error: "Invalid or already used verification link." };
    }

    // Always delete the token to enforce single-use
    await db.delete(verificationTokens).where(eq(verificationTokens.token, token.trim()));

    if (new Date() > new Date(record.expires)) {
        return { ok: false, error: "Verification link has expired. Please request a new one." };
    }

    return { ok: true, email: record.identifier };
}

/**
 * Links any pre-existing leads and projects matching the verified email
 * to the newly verified client account.
 */
export async function linkLeadsByEmail(userId: string, email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const matchingLeads = await db.query.leads.findMany({
        where: sql`lower(${leads.contactEmail}) = ${normalizedEmail}`,
        columns: { id: true, clientId: true },
    });

    for (const lead of matchingLeads) {
        if (!lead.clientId) {
            await db.update(leads).set({ clientId: userId }).where(eq(leads.id, lead.id));
        }

        const projects = await db.query.agencyProjects.findMany({
            where: eq(agencyProjects.leadId, lead.id),
            columns: { id: true },
        });

        for (const project of projects) {
            await db
                .insert(projectStakeholders)
                .values({
                    projectId: project.id,
                    userId,
                })
                .onConflictDoNothing();
        }
    }
}
