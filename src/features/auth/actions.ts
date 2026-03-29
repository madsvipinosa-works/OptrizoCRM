"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logAction } from "@/features/audit/actions"; // Optional audit
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/notifications";

export async function googleSignIn() {
    await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInWithEmail(prevState: unknown, formData: FormData) {
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

        return { success: true, redirect: "/dashboard" };
    } catch (error) {
        if (error instanceof AuthError) {
            const customMessage = error.cause?.err?.message;
            if (customMessage === "Account deactivated. Please contact an administrator.") {
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

export async function signUpWithEmail(prevState: unknown, formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    if (!email || !password) return { success: false, message: "Email and password are required" };
    if (password.length < 6) return { success: false, message: "Password must be at least 6 characters long" };

    try {
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (existing) return { success: false, message: "Email is already in use" };

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.insert(users).values({
            email,
            password: hashedPassword,
            name: name || null,
            role: "user",
        });

        await logAction("CREATE", "User", `New email account registered: ${email}`);

        await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        return { success: true, redirect: "/dashboard" };
    } catch (error) {
        if (error instanceof AuthError) {
            return { success: false, message: "Failed to automatically sign in after registration" };
        }
        if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
        console.error("Signup error:", error);
        return { success: false, message: "Server error during registration" };
    }
}

export async function requestPasswordReset(prevState: unknown, formData: FormData) {
    const email = formData.get("email") as string;
    
    if (!email) return { success: false, message: "Email is required" };

    try {
        const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
        
        // We always return generic success message to prevent email enumeration attacks
        if (!existingUser) {
            return { success: true, message: "If that email exists, we sent a password reset link to it." };
        }

        // Generate cryptographically secure token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

        await db.insert(passwordResetTokens).values({
            email,
            token,
            expiresAt,
        });

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;

        await sendPasswordResetEmail(email, resetUrl);
        await logAction("OTHER", "User", `Requested password reset: ${email}`);

        return { success: true, message: "If that email exists, we sent a password reset link to it." };
    } catch (error) {
        console.error("Password reset request error:", error);
        return { success: false, message: "Server error during password reset request" };
    }
}

export async function resetPassword(prevState: unknown, formData: FormData) {
    const token = formData.get("token") as string;
    const password = formData.get("password") as string;

    if (!token || !password) return { success: false, message: "Invalid request" };
    if (password.length < 6) return { success: false, message: "Password must be at least 6 characters long" };

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
