import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export interface SendMailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}

export interface SendMailResult {
    ok: boolean;
    skipped?: boolean;
    error?: unknown;
}

let cachedTransporter: Transporter | null = null;

/**
 * Resets the cached transporter instance. Used primarily in unit tests.
 */
export function resetMailerTransportForTesting(): void {
    cachedTransporter = null;
}

/**
 * Sends an email via SMTP using Nodemailer.
 * Reads SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * If any configuration is missing, logs a warning and returns { ok: false, skipped: true }.
 * Lazily creates and caches the transporter.
 */
export async function sendMail({ to, subject, html, text }: SendMailOptions): Promise<SendMailResult> {
    const host = process.env.SMTP_HOST;
    const portStr = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (!host || !portStr || !user || !pass || !from) {
        console.warn("[mailer] Incomplete SMTP configuration. Email delivery skipped.");
        return { ok: false, skipped: true };
    }

    const port = parseInt(portStr, 10);
    if (isNaN(port)) {
        console.warn("[mailer] Invalid SMTP_PORT. Email delivery skipped.");
        return { ok: false, skipped: true };
    }

    try {
        if (!cachedTransporter) {
            cachedTransporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: {
                    user,
                    pass,
                },
            });
        }

        await cachedTransporter.sendMail({
            from,
            to,
            subject,
            html,
            ...(text ? { text } : {}),
        });

        return { ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[mailer] Failed to send email: ${message}`);
        return { ok: false, error };
    }
}

