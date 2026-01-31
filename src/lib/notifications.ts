
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
