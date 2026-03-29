
import { Resend } from "resend";
import { db } from "@/db";

// Use a fallback key for development if not provided, but log warning
const resendApiKey = process.env.RESEND_API_KEY || "re_123_mock_key";
const resend = new Resend(resendApiKey);

// Email Template for New Leads
export async function sendLeadNotification(leadData: {
    name: string;
    email: string;
    message: string;
    service?: string;
    budget?: string;
    score?: number;
}) {
    try {
        // 1. Fetch Notification Recipients from Site Settings
        const settings = await db.query.siteSettings.findFirst();
        console.log("DEBUG: Site Settings Found:", settings);
        const recipientsRaw = settings?.notificationEmails || "";

        console.log("DEBUG: Raw Recipients:", recipientsRaw);
        console.log("DEBUG: API Key Present:", !!process.env.RESEND_API_KEY);

        // Filter valid emails

        // Filter valid emails
        const recipients = recipientsRaw
            .split(",")
            .map((e) => e.trim())
            .filter((e) => e.includes("@")); // Basic validation

        if (recipients.length === 0) {
            console.warn("No notification emails configured in Site Settings.");
            return;
        }

        console.log(`Sending Lead Alert to: ${recipients.join(", ")}`);

        if (!process.env.RESEND_API_KEY) {
            console.log("MOCK EMAIL SENT (Missing API Key):", leadData);
            return { success: true, mock: true };
        }

        // 2. Send Email via Resend
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: recipients,
            subject: `New Lead: ${leadData.name} - ${leadData.service || "General Inquiry"}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
                    <h2 style="color: #333;">New Lead Received! 🚀</h2>
                    <p><strong>Name:</strong> ${leadData.name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${leadData.email}">${leadData.email}</a></p>
                    <p><strong>Service:</strong> ${leadData.service || "N/A"}</p>
                    <p><strong>Budget:</strong> ${leadData.budget || "N/A"}</p>
                    <p><strong>Score:</strong> ${leadData.score ?? 0} / 100</p>
                    
                    <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                    
                    <h3 style="color: #666;">Message:</h3>
                    <p style="background: #f9f9f9; padding: 15px; border-radius: 4px; color: #555;">
                        "${leadData.message}"
                    </p>

                    <div style="margin-top: 30px; text-align: center;">
                        <a href="https://optrizo.com/dashboard/leads" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                            View in Dashboard
                        </a>
                    </div>
                </div>
            `,
        });

        if (error) {
            console.error("Resend Error:", error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error("Notification Failed:", err);
        return { success: false, error: err };
    }
}

// Email Template for New Clients (Won Leads)
export async function sendClientWelcomeEmail(clientData: {
    name: string;
    email: string;
    projectName: string;
}) {
    try {
        const portalUrl = process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/portal` : "http://localhost:3000/portal";

        if (!process.env.RESEND_API_KEY) {
            console.log(`[MOCK EMAIL] To: ${clientData.email} | Subject: Welcome to your Client Portal`);
            console.log(`Link: ${portalUrl}`);
            return { success: true, mock: true };
        }

        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: clientData.email,
            subject: `Welcome to Optrizo! Your project is ready.`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
                    <h2 style="color: #333;">Welcome aboard, ${clientData.name}! 🎉</h2>
                    <p style="color: #555; line-height: 1.5;">
                        We are thrilled to let you know that your project pipeline for <strong>${clientData.projectName}</strong> has been successfully provisioned.
                    </p>
                    <p style="color: #555; line-height: 1.5;">
                        You now have exclusive access to our unified Client Portal, where you can:
                    </p>
                    <ul style="color: #555; line-height: 1.5;">
                        <li>Track live project milestones and progress</li>
                        <li>Access all your shared documents, links, and staging environments</li>
                        <li>Communicate directly with our team</li>
                    </ul>
                    
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${portalUrl}" style="background-color: #10b981; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                            Access Your Client Portal
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        <em>Note: Please log in using this exact email address via Google.</em>
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error("Resend Error sending welcome email:", error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error("Welcome Email Failed:", err);
        return { success: false, error: err };
    }
}

// Email Template for Password Reset
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[MOCK EMAIL] To: ${email} | Subject: Reset Your Password - Optrizo`);
            console.log(`Link: ${resetUrl}`);
            return { success: true, mock: true };
        }

        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: email,
            subject: `Reset Your Password - Optrizo`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p style="color: #555; line-height: 1.5;">
                        We received a request to reset the password for your Optrizo account associated with this email address.
                    </p>
                    <p style="color: #555; line-height: 1.5;">
                        If you made this request, please click the button below to securely set a new password. This link will safely expire in 1 hour.
                    </p>
                    
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${resetUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        <em>Note: If you did not request a password reset, you can safely ignore this email. Your dashboard password will remain unchanged.</em>
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error("Resend Error sending password reset email:", error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error("Password Reset Email Failed:", err);
        return { success: false, error: err };
    }
}
