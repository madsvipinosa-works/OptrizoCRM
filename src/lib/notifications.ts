
import { Resend } from "resend";
import { db } from "@/db";
import { logSystemError } from "@/features/audit/error-logger";

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

}) {
    try {
        // 1. Fetch Notification Recipients from Site Settings
        const settings = await db.query.siteSettings.findFirst();
        console.log("DEBUG: Site Settings Found:", settings);
        const recipientsRaw = settings?.notificationEmails;

        console.log("DEBUG: Raw Recipients:", recipientsRaw);
        console.log("DEBUG: API Key Present:", !!process.env.RESEND_API_KEY);

        // Filter valid emails
        let recipients: string[] = [];
        if (Array.isArray(recipientsRaw)) {
            recipients = (recipientsRaw as string[]).map((e: string) => e.trim()).filter((e: string) => e.includes("@"));
        } else if (typeof recipientsRaw === "string") {
            recipients = (recipientsRaw as string).split(",").map((e: string) => e.trim()).filter((e: string) => e.includes("@"));
        }

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
        await logSystemError(err, {
            errorCode: "NOTIFICATION_EMAIL_FAILURE",
            severity: "HIGH",
            source: "lib:notifications:sendLeadNotification",
            context: { leadEmail: leadData.email, leadName: leadData.name },
        });
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

// Email Template for Client Onboarding (from Inquiry Conversion)
export async function sendClientOnboardingEmail(clientData: {
    name: string;
    email: string;
    resetUrl: string;
}) {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[MOCK EMAIL] To: ${clientData.email} | Subject: Welcome to Optrizo - Set Up Your Account`);
            console.log(`Link: ${clientData.resetUrl}`);
            return { success: true, mock: true };
        }

        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: clientData.email,
            subject: `Welcome to Optrizo - Set Up Your Account`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
                    <h2 style="color: #333;">Welcome to Optrizo, ${clientData.name}! 👋</h2>
                    <p style="color: #555; line-height: 1.5;">
                        We have successfully processed your inquiry and set up your dedicated Client Portal account. 
                        In your portal, you'll be able to review project proposals, track progress, and communicate with our team.
                    </p>
                    <p style="color: #555; line-height: 1.5;">
                        To get started and securely access any proposals we prepare for you, please set your password using the secure link below:
                    </p>
                    
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${clientData.resetUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                            Set Up Password
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        <em>Note: This link will expire in 1 hour. If it expires, you can always request a new one by trying to log in and clicking "Forgot Password".</em>
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error("Resend Error sending onboarding email:", error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error("Onboarding Email Failed:", err);
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

export async function sendTaskBlockedEmail(clientEmails: string[], projectName: string, taskTitle: string) {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[MOCK EMAIL] To: ${clientEmails.join(",")} | Subject: Action Required: Task Blocked`);
            return { success: true, mock: true };
        }
        
        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: clientEmails,
            subject: `Action Required: Optrizo Task Blocked`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
                    <h2 style="color: #333;">Action Required for ${projectName}</h2>
                    <p style="color: #555; line-height: 1.5;">
                        The task <strong>"${taskTitle}"</strong> has been marked as blocked and requires your input to proceed.
                    </p>
                    <p style="color: #555; line-height: 1.5;">
                        Please log in to your Client Portal to provide the necessary assets, feedback, or approval to unblock our team.
                    </p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/portal" style="background-color: #ef4444; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
                            Unblock Task in Portal
                        </a>
                    </div>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error("Task Blocked Email Failed:", err);
        return { success: false, error: err };
    }
}


// Email Template for Public Inquiry Confirmation (Mockup 011-1c)
export async function sendInquiryConfirmationEmail(data: {
    clientName: string;
    email: string;
    businessName: string;
    serviceName: string;
}) {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[MOCK EMAIL] To: ${data.email} | Subject: Inquiry Received: ${data.serviceName}`);
            return { success: true, mock: true };
        }

        const { data: resData, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: data.email,
            subject: `Inquiry Received - ${data.serviceName} | Optrizo Digital Solutions`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #d3dce1; border-radius: 12px; background: #ffffff; color: #14202b;">
                    <div style="font-size: 14px; font-weight: 600; color: #1c7742; background: #ddf2e6; padding: 4px 12px; border-radius: 999px; display: inline-block; margin-bottom: 16px;">
                        Inquiry received
                    </div>
                    <h2 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #14202b;">
                        Thank you, ${data.businessName || data.clientName}.
                    </h2>
                    <p style="margin: 0 0 20px; font-size: 16px; color: #4b5a67; line-height: 1.5;">
                        We received your request for <strong>${data.serviceName}</strong>.
                    </p>
                    <div style="background: #f7f9fa; border: 1px solid #d3dce1; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <h3 style="margin: 0 0 10px; font-size: 16px; font-weight: 600; color: #14202b;">What happens next</h3>
                        <ol style="margin: 0; padding-left: 20px; font-size: 15px; color: #4b5a67; line-height: 1.6;">
                            <li>Our team reviews your request.</li>
                            <li>We contact you to set up a short meeting.</li>
                            <li>After we meet, we send you a proposal.</li>
                        </ol>
                    </div>
                    <p style="font-size: 13px; color: #7a8b98; margin: 0;">
                        Optrizo Digital Solutions &bull; High-Performance Software Development
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error("Resend Error sending inquiry confirmation:", error);
            return { success: false, error };
        }

        return { success: true, data: resData };
    } catch (err) {
        console.error("Inquiry Confirmation Email Failed:", err);
        return { success: false, error: err };
    }
}


// Meeting Invite Email (Mockup 025-4a & Spec Section 4)
export async function sendMeetingInviteEmail(data: {
    clientName: string;
    email: string;
    meetingType: string;
    format: string;
    startsAt: Date;
    agenda?: string | null;
}) {
    try {
        const formattedDate = new Intl.DateTimeFormat("en-US", {
            dateStyle: "full",
            timeStyle: "short",
        }).format(data.startsAt);

        const portalBaseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const signupUrl = `${portalBaseUrl}/signup?email=${encodeURIComponent(data.email)}`;
        const appointmentsUrl = `${portalBaseUrl}/portal/appointments`;

        if (!process.env.RESEND_API_KEY) {
            console.log(`[MOCK EMAIL] To: ${data.email} | Subject: Meeting Invitation: ${data.meetingType} at ${formattedDate}`);
            return { success: true, mock: true };
        }

        const { data: resData, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: data.email,
            subject: `Invitation: ${data.meetingType} with Optrizo (${formattedDate})`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #d3dce1; border-radius: 12px; background: #ffffff; color: #14202b;">
                    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #14202b;">
                        Meeting Invitation: ${data.meetingType}
                    </h2>
                    <p style="margin: 0 0 16px; font-size: 15px; color: #4b5a67;">
                        Hello ${data.clientName}, you have been invited to a ${data.meetingType.toLowerCase()} meeting with the Optrizo team.
                    </p>
                    <div style="background: #f7f9fa; border: 1px solid #d3dce1; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                        <p style="margin: 0 0 8px; font-size: 14px;"><strong>Date & Time:</strong> ${formattedDate}</p>
                        <p style="margin: 0 0 8px; font-size: 14px;"><strong>Format:</strong> ${data.format}</p>
                        ${data.agenda ? `<p style="margin: 0; font-size: 14px;"><strong>Agenda:</strong> ${data.agenda}</p>` : ""}
                    </div>
                    <p style="font-size: 14px; color: #4b5a67; margin-bottom: 20px;">
                        To confirm this meeting, suggest another time, or view your appointments online, visit the Optrizo Client Portal:
                    </p>
                    <div style="margin-bottom: 24px;">
                        <a href="${appointmentsUrl}" style="background: #0e6b7e; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; margin-right: 12px;">
                            View in Client Portal
                        </a>
                        <a href="${signupUrl}" style="color: #0e6b7e; text-decoration: underline; font-size: 14px; display: inline-block; padding: 10px 0;">
                            Create portal account &rarr;
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #7a8b98; margin: 0;">
                        Optrizo Digital Solutions &bull; High-Performance Software Development
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error("Resend Error sending meeting invite:", error);
            return { success: false, error };
        }

        return { success: true, data: resData };
    } catch (err) {
        console.error("Meeting Invite Email Failed:", err);
        return { success: false, error: err };
    }
}

// Meeting Reminder Email (Mockup 076-4c & Spec Section 4)
export async function sendMeetingReminderEmail(data: {
    clientName: string;
    email: string;
    meetingType: string;
    format: string;
    startsAt: Date;
}) {
    try {
        const formattedDate = new Intl.DateTimeFormat("en-US", {
            dateStyle: "full",
            timeStyle: "short",
        }).format(data.startsAt);

        const portalBaseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const appointmentsUrl = `${portalBaseUrl}/portal/appointments`;

        if (!process.env.RESEND_API_KEY) {
            console.log(`[MOCK EMAIL] Reminder To: ${data.email} | ${data.meetingType} at ${formattedDate}`);
            return { success: true, mock: true };
        }

        const { data: resData, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: data.email,
            subject: `Reminder: ${data.meetingType} with Optrizo Tomorrow (${formattedDate})`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #d3dce1; border-radius: 12px; background: #ffffff; color: #14202b;">
                    <div style="font-size: 13px; font-weight: 600; color: #0e6b7e; background: #e0f0f3; padding: 4px 12px; border-radius: 999px; display: inline-block; margin-bottom: 16px;">
                        Meeting Reminder
                    </div>
                    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #14202b;">
                        Upcoming: ${data.meetingType}
                    </h2>
                    <p style="margin: 0 0 16px; font-size: 15px; color: #4b5a67;">
                        Hello ${data.clientName}, this is a reminder for your upcoming meeting with Optrizo.
                    </p>
                    <div style="background: #f7f9fa; border: 1px solid #d3dce1; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                        <p style="margin: 0 0 8px; font-size: 14px;"><strong>Date & Time:</strong> ${formattedDate}</p>
                        <p style="margin: 0; font-size: 14px;"><strong>Format:</strong> ${data.format}</p>
                    </div>
                    <p style="font-size: 14px; margin-bottom: 20px;">
                        <a href="${appointmentsUrl}" style="color: #0e6b7e; font-weight: 600; text-decoration: underline;">
                            View appointment details in your portal &rarr;
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #7a8b98; margin: 0;">
                        Optrizo Digital Solutions &bull; High-Performance Software Development
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error("Resend Error sending meeting reminder:", error);
            return { success: false, error };
        }

        return { success: true, data: resData };
    } catch (err) {
        console.error("Meeting Reminder Email Failed:", err);
        return { success: false, error: err };
    }
}
