"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { headers as nextHeaders } from "next/headers";
import { db } from "@/db";
import { users, verificationTokens } from "@/db/schema";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { requireRole } from "@/lib/authz";
import { logAction } from "@/features/audit/log";
import { sendStaffInviteEmail } from "@/lib/notifications";
import { checkRateLimit, formatRetryAfter, getClientIp } from "@/lib/rate-limit";
import { createStaffInvite, consumeStaffInvite } from "./invite";
import { getBaseUrl } from "@/lib/email-templates";

const STAFF_ROLES = ["sales", "manager", "developer", "content_editor"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

const InviteStaffSchema = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Please provide a valid email address."),
    name: z
        .string()
        .trim()
        .min(1, "Name is required.")
        .max(100, "Name must be 100 characters or less."),
    role: z.enum(STAFF_ROLES, {
        message: "Role must be one of: sales, manager, developer, content_editor.",
    }),
    jobTitle: z
        .string()
        .trim()
        .max(100, "Job title must be 100 characters or less.")
        .optional()
        .nullable(),
});

export interface InviteStaffInput {
    email: string;
    name: string;
    role: StaffRole;
    jobTitle?: string | null;
}

export type InviteActionResult =
    | { ok: true; emailSent?: boolean; message?: string }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function resolveIp(): Promise<string | null> {
    try {
        return getClientIp(await nextHeaders());
    } catch {
        return null;
    }
}

/**
 * Invites a new staff member (sales, manager, developer, content_editor).
 * Super Admin only.
 */
export async function inviteStaff(input: InviteStaffInput): Promise<InviteActionResult> {
    const authz = await requireRole(["superadmin"]);
    if (!authz.ok) {
        return { ok: false, error: "Unauthorized. Super Admin access required." };
    }

    const parsed = InviteStaffSchema.safeParse(input);
    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const field = issue.path[0];
            if (field) fieldErrors[String(field)] = issue.message;
        }
        return {
            ok: false,
            error: "Please correct the errors in the form.",
            fieldErrors,
        };
    }

    const { email, name, role, jobTitle } = parsed.data;

    let createdUser: { id: string };
    let inviteToken: string;

    try {
        const txResult = await db.transaction(async (tx) => {
            // Check if ANY user with this email exists (any status, including soft-deleted)
            const [existing] = await tx
                .select({ id: users.id })
                .from(users)
                .where(sql`lower(${users.email}) = ${email}`)
                .limit(1);

            if (existing) {
                throw new Error("A user with this email address already exists.");
            }

            // Insert pending staff account with status 'invited' and null password
            const [inserted] = await tx
                .insert(users)
                .values({
                    email,
                    name,
                    role,
                    jobTitle: jobTitle || null,
                    status: "invited",
                    password: null,
                    emailVerified: null,
                    isActive: true,
                    failedLogins: 0,
                    lockedUntil: null,
                })
                .returning({ id: users.id });

            if (!inserted) {
                throw new Error("Failed to create staff account.");
            }

            // Create single-use token in verificationToken
            const { rawToken } = await createStaffInvite(tx, {
                userId: inserted.id,
                email,
            });

            return { user: inserted, rawToken };
        });

        createdUser = txResult.user;
        inviteToken = txResult.rawToken;
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Failed to invite staff member.";
        return { ok: false, error: errorMsg };
    }

    // Send invitation email after transaction commit
    const baseUrl = getBaseUrl();
    const inviteLink = `${baseUrl}/accept-invite?token=${encodeURIComponent(inviteToken)}`;

    let emailSent = false;
    try {
        const sendRes = await sendStaffInviteEmail({
            to: email,
            name,
            role,
            link: inviteLink,
        });
        emailSent = !!sendRes.success && !sendRes.mock;
    } catch (mailErr) {
        console.error("Failed to send staff invitation email:", mailErr);
    }

    // Audit log written last with actor role in details (never the raw token)
    try {
        const actorRole = authz.session.user.role || "superadmin";
        await logAction(
            "CREATE",
            "user",
            `Invited staff member ${email} as ${role} (actor: ${actorRole})`,
            createdUser.id
        );
    } catch (auditErr) {
        console.error("Audit log failure in inviteStaff:", auditErr);
    }

    return { ok: true, emailSent };
}

/**
 * Resends a staff invitation email with a fresh 48-hour token.
 * Super Admin only; rate-limited per target user.
 */
export async function resendStaffInvite(userId: string): Promise<InviteActionResult> {
    const authz = await requireRole(["superadmin"]);
    if (!authz.ok) {
        return { ok: false, error: "Unauthorized. Super Admin access required." };
    }

    if (!userId || typeof userId !== "string") {
        return { ok: false, error: "Invalid user identifier." };
    }

    const limit = await checkRateLimit("inviteResend", userId);
    if (!limit.success) {
        return {
            ok: false,
            error: `Too many resend attempts for this user. Please try again in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
        };
    }

    let targetUser: { id: string; email: string; name: string | null; role: string };
    let inviteToken: string;

    try {
        const txResult = await db.transaction(async (tx) => {
            const [target] = await tx
                .select({
                    id: users.id,
                    email: users.email,
                    name: users.name,
                    role: users.role,
                    status: users.status,
                    password: users.password,
                })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);

            if (!target) {
                throw new Error("Target user account not found.");
            }

            if (target.status !== "invited" || target.role === "client" || target.password !== null) {
                throw new Error("Target account is not an unaccepted staff invitation.");
            }

            // In one transaction: delete old staff-invite tokens for that email, create a new one
            await tx
                .delete(verificationTokens)
                .where(eq(verificationTokens.identifier, `staff-invite:${target.email.toLowerCase()}`));

            const { rawToken } = await createStaffInvite(tx, {
                userId: target.id,
                email: target.email,
            });

            return {
                target: {
                    id: target.id,
                    email: target.email,
                    name: target.name,
                    role: target.role,
                },
                rawToken,
            };
        });

        targetUser = txResult.target;
        inviteToken = txResult.rawToken;
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Failed to resend staff invitation.";
        return { ok: false, error: errorMsg };
    }

    // Send after commit
    const baseUrl = getBaseUrl();
    const inviteLink = `${baseUrl}/accept-invite?token=${encodeURIComponent(inviteToken)}`;

    let emailSent = false;
    try {
        const sendRes = await sendStaffInviteEmail({
            to: targetUser.email,
            name: targetUser.name || "Staff Member",
            role: targetUser.role,
            link: inviteLink,
        });
        emailSent = !!sendRes.success && !sendRes.mock;
    } catch (mailErr) {
        console.error("Failed to resend staff invite email:", mailErr);
    }

    // Audit log last
    try {
        const actorRole = authz.session.user.role || "superadmin";
        await logAction(
            "UPDATE",
            "user",
            `Resent staff invite to ${targetUser.email} (actor: ${actorRole})`,
            targetUser.id
        );
    } catch (auditErr) {
        console.error("Audit log error in resendStaffInvite:", auditErr);
    }

    return { ok: true, emailSent };
}

/**
 * Cancels a pending staff invite, deleting associated tokens and the pending user row.
 * Super Admin only.
 */
export async function cancelStaffInvite(userId: string): Promise<InviteActionResult> {
    const authz = await requireRole(["superadmin"]);
    if (!authz.ok) {
        return { ok: false, error: "Unauthorized. Super Admin access required." };
    }

    if (!userId || typeof userId !== "string") {
        return { ok: false, error: "Invalid user identifier." };
    }

    let deletedEmail: string;

    try {
        const result = await db.transaction(async (tx) => {
            const [target] = await tx
                .select({
                    id: users.id,
                    email: users.email,
                    status: users.status,
                    role: users.role,
                    password: users.password,
                })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);

            if (!target) {
                throw new Error("Target user account not found.");
            }

            if (target.status !== "invited" || target.role === "client" || target.password !== null) {
                throw new Error("Target account is not an unaccepted staff invitation.");
            }

            // Delete tokens
            await tx
                .delete(verificationTokens)
                .where(eq(verificationTokens.identifier, `staff-invite:${target.email.toLowerCase()}`));

            // Delete user row guarded by status='invited' and password IS NULL
            await tx
                .delete(users)
                .where(
                    and(
                        eq(users.id, userId),
                        eq(users.status, "invited"),
                        isNull(users.password)
                    )
                );

            return { email: target.email };
        });

        deletedEmail = result.email;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "";
        const code = (err as { code?: string })?.code;

        // Foreign key violation check (PostgreSQL 23503)
        if (code === "23503" || message.toLowerCase().includes("foreign key")) {
            return {
                ok: false,
                error: "Cannot cancel invitation because associated activity records exist. Deactivate the account instead.",
            };
        }

        return { ok: false, error: message || "Failed to cancel staff invitation." };
    }

    // Audit log last
    try {
        const actorRole = authz.session.user.role || "superadmin";
        await logAction(
            "DELETE",
            "user",
            `Cancelled staff invite for ${deletedEmail} (actor: ${actorRole})`,
            userId
        );
    } catch (auditErr) {
        console.error("Audit log error in cancelStaffInvite:", auditErr);
    }

    return { ok: true, message: "Staff invitation cancelled successfully." };
}

const AcceptStaffInviteSchema = z.object({
    token: z.string().trim().min(1, "Invite token is required."),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters long.")
        .refine((p) => /[A-Z]/.test(p), "Password must contain at least one uppercase letter.")
        .refine((p) => /[^a-zA-Z]/.test(p), "Password must contain at least one number or symbol."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});

export interface AcceptStaffInviteInput {
    token: string;
    password: string;
    confirmPassword: string;
}

/**
 * Public endpoint to accept a staff invitation and establish an initial password.
 * Rate-limited by IP.
 */
export async function acceptStaffInvite(input: AcceptStaffInviteInput): Promise<InviteActionResult> {
    const ip = await resolveIp();
    if (ip) {
        const limit = await checkRateLimit("inviteAccept", ip);
        if (!limit.success) {
            return {
                ok: false,
                error: `Too many attempts from your network. Please try again in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
            };
        }
    }

    const parsed = AcceptStaffInviteSchema.safeParse(input);
    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const field = issue.path[0];
            if (field) fieldErrors[String(field)] = issue.message;
        }
        return {
            ok: false,
            error: parsed.error.issues[0]?.message || "Invalid password submission.",
            fieldErrors,
        };
    }

    const { token, password } = parsed.data;
    const genericError = "This invite is invalid or has expired.";

    let acceptedUser: { id: string; email: string };

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const txResult = await db.transaction(async (tx) => {
            // 1. Consume staff invite token
            const consumed = await consumeStaffInvite(tx, token);
            if (!consumed) {
                throw new Error(genericError);
            }

            // 2. Atomically update user: set password, status='active', emailVerified=now, failedLogins=0
            const [updated] = await tx
                .update(users)
                .set({
                    password: hashedPassword,
                    status: "active",
                    isActive: true,
                    emailVerified: new Date(),
                    failedLogins: 0,
                    lockedUntil: null,
                })
                .where(
                    and(
                        sql`lower(${users.email}) = ${consumed.email.toLowerCase()}`,
                        eq(users.status, "invited"),
                        isNull(users.password),
                        ne(users.role, "client")
                    )
                )
                .returning({ id: users.id, email: users.email });

            if (!updated) {
                throw new Error(genericError);
            }

            return updated;
        });

        acceptedUser = txResult;
    } catch {
        return { ok: false, error: genericError };
    }

    // Audit log after commit
    try {
        await logAction(
            "UPDATE",
            "user",
            `Accepted staff invite for account: ${acceptedUser.email}`,
            acceptedUser.id
        );
    } catch (auditErr) {
        console.error("Audit log error in acceptStaffInvite:", auditErr);
    }

    return { ok: true, message: "Password set successfully. You may now sign in." };
}
