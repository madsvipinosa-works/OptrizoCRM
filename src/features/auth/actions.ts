"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logAction } from "@/features/audit/log"; // Optional audit
import crypto from "crypto";
import { sendPasswordResetEmail, sendEmailVerificationEmail } from "@/lib/notifications";
import { createVerificationToken, consumeVerificationToken, linkLeadsByEmail } from "@/features/auth/verification";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
    checkRateLimit,
    formatRetryAfter,
    getClientIp,
    normalizeEmail,
    RATE_LIMIT_ERROR_NAME,
} from "@/lib/rate-limit";

async function getRequestIp(): Promise<string | null> {
    try {
        return getClientIp(await headers());
    } catch {
        return null;
    }
}

export type AuthActionResult = {
    success: boolean;
    message?: string;
    redirect?: string;
    fieldErrors?: Record<string, string>;
};

export async function updateAccountName(nameValue: string): Promise<AuthActionResult> {
    const session = await auth();
    const userId = session?.user?.id;
    const name = nameValue.trim();
    if (!userId) return { success: false, message: "Please sign in to update your account." };
    if (name.length < 2 || name.length > 80) {
        return { success: false, message: "Name must be between 2 and 80 characters." };
    }

    try {
        await db.update(users).set({ name }).where(eq(users.id, userId));
        revalidatePath("/portal/settings");
        return { success: true, message: "Your name has been updated." };
    } catch (error) {
        console.error("Account name update error:", error);
        return { success: false, message: "Could not update your name. Please try again." };
    }
}

export async function updateAccountPassword(
    currentPassword: string,
    newPassword: string,
): Promise<AuthActionResult> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, message: "Please sign in to update your password." };
    if (!currentPassword || !newPassword) return { success: false, message: "Complete all password fields." };
    if (newPassword.length < 8) return { success: false, message: "Password must be at least 8 characters long." };
    if (!/[A-Z]/.test(newPassword)) return { success: false, message: "Password must contain at least one uppercase letter." };
    if (!/[^a-zA-Z]/.test(newPassword)) return { success: false, message: "Password must contain at least one number or symbol." };

    try {
        const [user] = await db.select({ password: users.password }).from(users).where(eq(users.id, userId)).limit(1);
        if (!user?.password) {
            return { success: false, message: "This account does not have a password. Use password reset to set one." };
        }
        if (!(await bcrypt.compare(currentPassword, user.password))) {
            return { success: false, message: "Your current password is incorrect." };
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
        await logAction("UPDATE", "User", `Password changed for account: ${session.user?.email ?? userId}`);
        return { success: true, message: "Your password has been updated." };
    } catch (error) {
        console.error("Account password update error:", error);
        return { success: false, message: "Could not update your password. Please try again." };
    }
}

function tooManyAttempts(retryAfterSeconds: number): AuthActionResult {
    return {
        success: false,
        message: `Too many attempts. Please try again in ${formatRetryAfter(retryAfterSeconds)}.`,
    };
}

function getLandingPageForRole(role?: string | null): string {
    switch (role) {
        case "sales":
        case "manager":
            return "/dashboard";
        case "developer":
            return "/dashboard/pm";
        case "content_editor":
            return "/dashboard/cms";
        case "superadmin":
            return "/dashboard/analytics";
        case "client":
        default:
            return "/portal";
    }
}

export async function googleSignIn(callbackUrl?: string) {
    const targetRedirect = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
    await signIn("google", { redirectTo: targetRedirect });
}

export async function signInWithEmail(prevState: unknown, formData: FormData): Promise<AuthActionResult> {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) return { success: false, message: "Email and password are required" };

    try {
        await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        // Audit log on login
        await logAction("LOGIN", "User", `Email login: ${email}`);

        // Lookup user role to determine smart redirect
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
            columns: { role: true },
        });

        const defaultLanding = getLandingPageForRole(user?.role);
        const callbackUrl = (formData.get("callbackUrl") as string);
        const hasExplicitCallback = callbackUrl && callbackUrl.startsWith("/") && callbackUrl !== "/dashboard";

        const targetRedirect = hasExplicitCallback
            ? callbackUrl
            : defaultLanding;

        return { success: true, redirect: targetRedirect };
    } catch (error) {
        if (error instanceof AuthError) {
            const cause = error.cause?.err;
            // Rate-limit rejections are thrown from the credentials authorize() callback.
            if (cause?.name === RATE_LIMIT_ERROR_NAME) {
                return { success: false, message: cause.message };
            }
            const customMessage = cause?.message;
            if (customMessage) {
                return { success: false, message: customMessage };
            }
            switch (error.type) {
                case "CredentialsSignin":
                    return { success: false, message: "Invalid email or password" };
                default:
                    return { success: false, message: "Authentication failed" };
            }
        }
        if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
        return { success: false, message: "Server error" };
    }
}

export async function signUpWithEmail(prevState: unknown, formData: FormData): Promise<AuthActionResult> {
    const rawEmail = (formData.get("email") as string) || "";
    const rawPassword = (formData.get("password") as string) || "";
    const rawName = (formData.get("name") as string) || "";
    const rawConfirm = (formData.get("confirmPassword") as string) || "";

    const name = rawName.trim();
    const email = rawEmail.trim().toLowerCase();
    const password = rawPassword;
    const confirmPassword = rawConfirm;

    const fieldErrors: Record<string, string> = {};

    if (!name || name.length < 2 || name.length > 80) {
        fieldErrors.name = "Name must be between 2 and 80 characters.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        fieldErrors.email = "Please enter a valid email address.";
    }

    if (!password || password.length < 8) {
        fieldErrors.password = "Password must be at least 8 characters long.";
    } else if (!/[A-Z]/.test(password)) {
        fieldErrors.password = "Password must contain at least one uppercase letter.";
    } else if (!/[^a-zA-Z]/.test(password)) {
        fieldErrors.password = "Password must contain at least one number or symbol.";
    }

    if (!confirmPassword) {
        fieldErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
        fieldErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            success: false,
            message: "Please correct the errors below.",
            fieldErrors,
        };
    }

    const ip = await getRequestIp();
    if (ip) {
        const limit = await checkRateLimit("signupIp", ip);
        if (!limit.success) {
            console.warn(`[Security] Signup rate limit hit: ip=${ip}`);
            return tooManyAttempts(limit.retryAfterSeconds);
        }
    }
    const emailLimit = await checkRateLimit("signupEmail", email);
    if (!emailLimit.success) {
        console.warn(`[Security] Signup rate limit hit: email=${email}`);
        return tooManyAttempts(emailLimit.retryAfterSeconds);
    }

    try {
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (existing) {
            if (existing.status === "invited") {
                // If account exists with 'invited' status, create fresh token and resend with generic success message
                try {
                    const token = await createVerificationToken(email);
                    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
                    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
                    await sendEmailVerificationEmail({
                        email,
                        name: existing.name || name || "Client",
                        verifyUrl,
                    });
                } catch (emailErr) {
                    console.error("Failed to resend verification email for existing invited user:", emailErr);
                    return {
                        success: true,
                        message: "Account registered, but we could not send the verification email. Sign up again with the same email to get a new verification link.",
                    };
                }
                return {
                    success: true,
                    message: "Verification email sent. Please check your inbox to activate your account.",
                };
            }

            return {
                success: false,
                message: "Email is already in use.",
                fieldErrors: { email: "Email is already in use." },
            };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.insert(users).values({
            email,
            password: hashedPassword,
            name: name || null,
            role: "client",
            status: "invited",
        });

        await logAction("CREATE", "User", `New client account registered (awaiting verification): ${email}`);

        // Create verification token and dispatch activation email in try/catch
        try {
            const token = await createVerificationToken(email);
            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
            const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

            await sendEmailVerificationEmail({
                email,
                name: name || "Client",
                verifyUrl,
            });

            return {
                success: true,
                message: "Verification email sent. Please check your inbox to activate your account.",
            };
        } catch (emailErr) {
            console.error("Failed to send verification email for newly registered user:", emailErr);
            return {
                success: true,
                message: "Account registered, but we could not send the verification email. Sign up again with the same email to get a new verification link.",
            };
        }
    } catch (error) {
        console.error("Signup error:", error);
        return { success: false, message: "Server error during registration" };
    }
}

/**
 * Validates a single-use verification token and activates the account.
 * Single transaction consumes token, activates invited user, and links leads/projects.
 * Rate-limited by IP.
 */
export async function verifyEmail(token: string): Promise<AuthActionResult> {
    if (!token || typeof token !== "string") {
        return { success: false, message: "Invalid verification link." };
    }

    const ip = await getRequestIp();
    if (ip) {
        const ipLimit = await checkRateLimit("verifyResendIp", ip);
        if (!ipLimit.success) {
            return tooManyAttempts(ipLimit.retryAfterSeconds);
        }
    }

    try {
        const result = await db.transaction(async (tx) => {
            const consumeResult = await consumeVerificationToken(token, tx);
            if (!consumeResult.ok) {
                return { success: false, message: consumeResult.error };
            }

            const email = consumeResult.email;
            const user = await tx.query.users.findFirst({
                where: eq(users.email, email),
            });

            if (!user) {
                return { success: false, message: "Account not found." };
            }

            // Only set active when status = 'invited' (never reactivate deactivated or locked)
            if (user.status !== "invited") {
                if (user.status === "active") {
                    return {
                        success: true,
                        message: "Your account is already active. You may sign in.",
                        redirect: "/login",
                    };
                }
                return {
                    success: false,
                    message: "Account is not eligible for verification. Please contact support.",
                };
            }

            await tx
                .update(users)
                .set({
                    status: "active",
                    emailVerified: new Date(),
                })
                .where(eq(users.id, user.id));

            // Link existing leads and projects
            await linkLeadsByEmail(user.id, email, tx);

            return {
                success: true,
                userId: user.id,
                email,
            };
        });

        if (!result.success) {
            return { success: false, message: result.message };
        }

        if (result.userId && result.email) {
            try {
                await logAction("UPDATE", "User", `Email verified for account: ${result.email}`, result.userId);
            } catch (logErr) {
                console.error("Audit log error in verifyEmail:", logErr);
            }
        }

        return {
            success: true,
            message: "Your email has been verified. You may now sign in to your client portal.",
            redirect: "/login?verified=true",
        };
    } catch (error) {
        console.error("verifyEmail error:", error);
        return { success: false, message: "Server error during email verification." };
    }
}

/**
 * Resends a verification email for an unverified ('invited') account.
 * Rate-limited by IP and email.
 */
export async function resendVerificationEmail(email: string): Promise<AuthActionResult> {
    if (!email || typeof email !== "string") {
        return { success: false, message: "Email is required." };
    }

    const normalized = normalizeEmail(email);

    const ip = await getRequestIp();
    if (ip) {
        const ipLimit = await checkRateLimit("verifyResendIp", ip);
        if (!ipLimit.success) {
            return tooManyAttempts(ipLimit.retryAfterSeconds);
        }
    }
    const emailLimit = await checkRateLimit("verifyResendEmail", normalized);
    if (!emailLimit.success) {
        return tooManyAttempts(emailLimit.retryAfterSeconds);
    }

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.email, normalized),
        });

        // Anti-enumeration: return generic success if user does not exist
        if (!user) {
            return {
                success: true,
                message: "If an account exists with this email, a verification link has been sent.",
            };
        }

        if (user.status === "active") {
            return {
                success: false,
                message: "This account is already verified. Please sign in.",
            };
        }

        if (user.status === "invited") {
            const token = await createVerificationToken(normalized);
            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
            const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

            await sendEmailVerificationEmail({
                email: normalized,
                name: user.name || "Client",
                verifyUrl,
            });

            await logAction("OTHER", "User", `Resent verification email for: ${normalized}`);
        }

        return {
            success: true,
            message: "If an account exists with this email, a verification link has been sent.",
        };
    } catch (error) {
        console.error("resendVerificationEmail error:", error);
        return { success: false, message: "Server error resending verification email." };
    }
}

export async function requestPasswordReset(prevState: unknown, formData: FormData): Promise<AuthActionResult> {
    const email = formData.get("email") as string;

    if (!email) return { success: false, message: "Email is required" };

    // Applied regardless of whether the account exists, so limits don't reveal valid emails.
    const ip = await getRequestIp();
    if (ip) {
        const ipLimit = await checkRateLimit("passwordResetRequestIp", ip);
        if (!ipLimit.success) {
            console.warn(`[Security] Password reset request rate limit (IP) hit: ip=${ip}`);
            return tooManyAttempts(ipLimit.retryAfterSeconds);
        }
    }
    const emailLimit = await checkRateLimit("passwordResetRequestEmail", normalizeEmail(email));
    if (!emailLimit.success) {
        return tooManyAttempts(emailLimit.retryAfterSeconds);
    }

    try {
        const normalizedEmail = normalizeEmail(email);
        const existingUser = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });

        // We always return generic success message to prevent email enumeration attacks
        if (!existingUser) {
            return { success: true, message: "If that email exists, we sent a password reset link to it." };
        }

        // Delete any existing password reset tokens for this email
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, normalizedEmail));

        // Generate cryptographically secure token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

        await db.insert(passwordResetTokens).values({
            email: normalizedEmail,
            token,
            expiresAt,
        });

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;

        await sendPasswordResetEmail(normalizedEmail, resetUrl);
        await logAction("OTHER", "User", `Requested password reset: ${normalizedEmail}`);

        return { success: true, message: "If that email exists, we sent a password reset link to it." };
    } catch (error) {
        console.error("Password reset request error:", error);
        return { success: false, message: "Server error during password reset request" };
    }
}

export async function resetPassword(prevState: unknown, formData: FormData): Promise<AuthActionResult> {
    const token = formData.get("token") as string;
    const password = formData.get("password") as string;
    const confirmPassword = (formData.get("confirmPassword") as string) || "";

    if (!token || !password) return { success: false, message: "Invalid request" };
    if (!confirmPassword) return { success: false, message: "Please confirm your password." };
    if (password !== confirmPassword) return { success: false, message: "Passwords do not match." };
    if (password.length < 8) return { success: false, message: "Password must be at least 8 characters long" };
    if (!/[A-Z]/.test(password)) return { success: false, message: "Password must contain at least one uppercase letter" };
    if (!/[^a-zA-Z]/.test(password)) return { success: false, message: "Password must contain at least one number or symbol" };

    const ip = await getRequestIp();
    if (ip) {
        const limit = await checkRateLimit("passwordResetSubmitIp", ip);
        if (!limit.success) {
            console.warn(`[Security] Password reset submit rate limit hit: ip=${ip}`);
            return tooManyAttempts(limit.retryAfterSeconds);
        }
    }

    try {
        const record = await db.query.passwordResetTokens.findFirst({
            where: eq(passwordResetTokens.token, token)
        });

        if (!record || record.expiresAt < new Date()) {
            return { success: false, message: "This password reset link is invalid or has expired." };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Safely update user's password
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.email, record.email));

        // Ensure token cannot be used again
        await db.delete(passwordResetTokens)
            .where(eq(passwordResetTokens.token, token));

        await logAction("UPDATE", "User", `Password reset completed for: ${record.email}`);

        return { success: true, redirect: "/?login=true" }; // Or redirect to home/login
    } catch (error) {
        console.error("Password reset update error:", error);
        return { success: false, message: "Server error updating password" };
    }
}
