import "server-only";

import crypto from "crypto";
import { verificationTokens } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import type { DbTransaction } from "./account-status";

export function hashInviteToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generates a 32-byte base64url staff invitation token valid for 48 hours.
 * Cleans up prior staff-invite tokens for the email and stores ONLY sha256(rawToken).
 * The raw token exists in memory only to be embedded into the emailed link.
 */
export async function createStaffInvite(
    tx: DbTransaction,
    { email }: { userId: string; email: string }
): Promise<{ rawToken: string }> {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashInviteToken(rawToken);
    const normalizedEmail = email.trim().toLowerCase();
    const identifier = `staff-invite:${normalizedEmail}`;
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Clean up any existing staff-invite tokens for this email
    await tx
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, identifier));

    await tx.insert(verificationTokens).values({
        identifier,
        token: tokenHash,
        expires,
    });

    return { rawToken };
}

/**
 * Atomically consumes and deletes a staff invite token.
 * Single-use: DELETE ... WHERE token=hash AND identifier LIKE 'staff-invite:%' AND expires > now() RETURNING identifier.
 * Returns the lowercased email if valid; otherwise null.
 */
export async function consumeStaffInvite(
    tx: DbTransaction,
    rawToken: string
): Promise<{ email: string } | null> {
    if (!rawToken || typeof rawToken !== "string") {
        return null;
    }

    const tokenHash = hashInviteToken(rawToken.trim());

    const deleted = await tx
        .delete(verificationTokens)
        .where(
            and(
                eq(verificationTokens.token, tokenHash),
                sql`${verificationTokens.identifier} LIKE 'staff-invite:%'`,
                gt(verificationTokens.expires, sql`now()`)
            )
        )
        .returning({ identifier: verificationTokens.identifier });

    if (!deleted || deleted.length === 0) {
        return null;
    }

    const identifier = deleted[0].identifier;
    const prefix = "staff-invite:";
    if (!identifier.startsWith(prefix)) {
        return null;
    }

    const email = identifier.slice(prefix.length).trim().toLowerCase();
    return { email };
}
