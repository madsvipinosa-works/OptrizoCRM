import { db } from "@/db";
import { logSystemError } from "@/features/audit/error-logger";
import { sendMail } from "@/lib/mailer";
import {
    buildInquiryReceivedEmail,
    buildMeetingCancelledEmail,
    buildMeetingInviteEmail,
    buildMeetingRescheduledEmail,
    buildProposalSentEmail,
    formatManilaDateTime,
    meetingFormatLabel,
    type ClientEmail,
    type MeetingFormat,
} from "@/lib/email-templates";

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

        // 2. Send Email via Nodemailer SMTP
        const result = await sendMail({
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

        if (!result.ok && !result.skipped) {
            console.error("Email Error:", result.error);
            return { success: false, error: result.error };
        }

        return { success: true, mock: result.skipped };
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

        const result = await sendMail({
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

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending welcome email:", result.error);
            return { success: false, error: result.error };
        }

        return { success: true, mock: result.skipped };
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
        const result = await sendMail({
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

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending onboarding email:", result.error);
            return { success: false, error: result.error };
        }

        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("Onboarding Email Failed:", err);
        return { success: false, error: err };
    }
}

// Email Template for Password Reset
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
    try {
        const result = await sendMail({
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

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending password reset email:", result.error);
            return { success: false, error: result.error };
        }

        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("Password Reset Email Failed:", err);
        return { success: false, error: err };
    }
}

export async function sendTaskBlockedEmail(clientEmails: string[], projectName: string, taskTitle: string) {
    try {
        const result = await sendMail({
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

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending task blocked email:", result.error);
            return { success: false, error: result.error };
        }

        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("Task Blocked Email Failed:", err);
        return { success: false, error: err };
    }
}


// Public inquiry confirmation (mockup 011-1c). Content lives in src/lib/email-templates.ts.
export async function sendInquiryConfirmationEmail(data: {
    clientName: string;
    email: string;
    businessName: string;
    serviceName: string;
    /** Public page of the service they picked, when they picked one from the list. */
    serviceUrl?: string | null;
    /** Sales person's name, when one is already assigned. */
    contactName?: string | null;
}) {
    return sendClientEmail(
        data.email,
        buildInquiryReceivedEmail({
            clientName: data.clientName,
            businessName: data.businessName,
            serviceName: data.serviceName,
            serviceUrl: data.serviceUrl,
            contactName: data.contactName,
        }),
        "inquiry confirmation",
    );
}

// Meeting invite (mockup 025-4a, spec step 4). Content lives in src/lib/email-templates.ts.
export async function sendMeetingInviteEmail(data: Parameters<typeof buildMeetingInviteEmail>[0]) {
    return sendClientEmail(data.email, buildMeetingInviteEmail(data), "meeting invite");
}

export async function sendMeetingRescheduledEmail(data: Parameters<typeof buildMeetingRescheduledEmail>[0]) {
    return sendClientEmail(data.email, buildMeetingRescheduledEmail(data), "meeting rescheduled");
}

export async function sendMeetingCancelledEmail(data: Parameters<typeof buildMeetingCancelledEmail>[0]) {
    return sendClientEmail(data.email, buildMeetingCancelledEmail(data), "meeting cancelled");
}

export async function sendProposalSentEmail(data: Parameters<typeof buildProposalSentEmail>[0] & { email: string }) {
    return sendClientEmail(data.email, buildProposalSentEmail(data), "proposal sent");
}

async function sendClientEmail(to: string, email: ClientEmail, label: string) {
    try {
        const result = await sendMail({ to, subject: email.subject, html: email.html, text: email.text });

        if (!result.ok && !result.skipped) {
            console.error(`Email Error sending ${label}:`, result.error);
            return { success: false, error: result.error };
        }

        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error(`Email failed (${label}):`, err);
        return { success: false, error: err };
    }
}

// Meeting Reminder Email (Mockup 076-4c & Spec Section 4)
export async function sendMeetingReminderEmail(data: {
    clientName: string;
    email: string;
    meetingType: string;
    format: MeetingFormat;
    startsAt: Date;
}) {
    try {
        const formattedDate = formatManilaDateTime(data.startsAt);

        const portalBaseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const appointmentsUrl = `${portalBaseUrl}/portal/appointments`;

        const result = await sendMail({
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
                        <p style="margin: 0; font-size: 14px;"><strong>Format:</strong> ${meetingFormatLabel(data.format)}</p>
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

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending meeting reminder:", result.error);
            return { success: false, error: result.error };
        }

        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("Meeting Reminder Email Failed:", err);
        return { success: false, error: err };
    }
}

/**
 * Sends a confirmation email to the client containing a link to download the signed proposal PDF.
 * Per specification, no file attachment is included; only a direct link to the PDF route.
 */
export async function sendSignedProposalEmail(data: {
    clientEmail: string;
    clientName: string;
    proposalCode?: string | null;
    pdfUrl: string;
}) {
    try {
        const result = await sendMail({
            to: data.clientEmail,
            subject: `Signed Statement of Work Copy - ${data.proposalCode || "Optrizo"}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px 20px; color: #14202b;">
                    <div style="margin-bottom: 24px;">
                        <span style="font-size: 18px; font-weight: 700; color: #0e6b7e; letter-spacing: -0.02em;">OPTRIZO</span>
                    </div>
                    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #14202b;">
                        Agreement Executed: ${data.proposalCode || "Project Proposal"}
                    </h2>
                    <p style="margin: 0 0 16px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        Hello ${data.clientName}, your project proposal has been successfully accepted and executed.
                    </p>
                    <p style="margin: 0 0 20px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        Our engineering and delivery team has initialized your project kickoff. You can download and review your official signed Statement of Work PDF using the link below:
                    </p>
                    <div style="margin: 24px 0;">
                        <a href="${data.pdfUrl}" style="background-color: #0e6b7e; color: #ffffff; padding: 12px 22px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 14px;">
                            Download Signed SOW (PDF) &rarr;
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #7a8b98; margin: 24px 0 0;">
                        Optrizo Digital Solutions &bull; Official Digital Execution Record
                    </p>
                </div>
            `,
        });

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending signed proposal email:", result.error);
            return { success: false, error: result.error };
        }
        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("sendSignedProposalEmail error:", err);
        return { success: false, error: err };
    }
}

/**
 * Sends a notification email when a payment becomes due.
 */
export async function sendPaymentDueEmail(data: {
    clientEmail: string;
    clientName: string;
    projectTitle: string;
    amount: string;
    currency: string;
    dueDate?: Date | null;
    paymentsUrl: string;
}) {
    try {
        const formattedDate = data.dueDate
            ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(data.dueDate))
            : "Due Upon Receipt";

        const result = await sendMail({
            to: data.clientEmail,
            subject: `Payment Due: ${data.projectTitle} - ${data.currency} ${data.amount}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px 20px; color: #14202b;">
                    <div style="margin-bottom: 24px;">
                        <span style="font-size: 18px; font-weight: 700; color: #0e6b7e; letter-spacing: -0.02em;">OPTRIZO</span>
                    </div>
                    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #14202b;">
                        Payment Due Notice
                    </h2>
                    <p style="margin: 0 0 16px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        Hello ${data.clientName}, a milestone payment for <strong>${data.projectTitle}</strong> has reached its due status.
                    </p>
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">Amount Due:</p>
                        <p style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #0f172a;">${data.currency} ${data.amount}</p>
                        <p style="margin: 0; font-size: 13px; color: #64748b;">Due Date: <strong>${formattedDate}</strong></p>
                    </div>
                    <p style="margin: 0 0 20px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        Please review payment instructions and upload your payment proof via your client portal:
                    </p>
                    <div style="margin: 24px 0;">
                        <a href="${data.paymentsUrl}" style="background-color: #0e6b7e; color: #ffffff; padding: 12px 22px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 14px;">
                            View Payment & Upload Proof &rarr;
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #7a8b98; margin: 24px 0 0;">
                        Optrizo Digital Solutions &bull; Financial Notification
                    </p>
                </div>
            `,
        });

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending payment due email:", result.error);
            return { success: false, error: result.error };
        }
        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("sendPaymentDueEmail error:", err);
        return { success: false, error: err };
    }
}

/**
 * Sends a notification email when a project is completed.
 */
export async function sendProjectCompleteEmail(data: {
    clientEmail: string;
    clientName: string;
    projectTitle: string;
    portalUrl: string;
}) {
    try {
        const result = await sendMail({
            to: data.clientEmail,
            subject: `Project Completed: ${data.projectTitle}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px 20px; color: #14202b;">
                    <div style="margin-bottom: 24px;">
                        <span style="font-size: 18px; font-weight: 700; color: #0e6b7e; letter-spacing: -0.02em;">OPTRIZO</span>
                    </div>
                    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #14202b;">
                        Your Project is Complete! 🎉
                    </h2>
                    <p style="margin: 0 0 16px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        Hello ${data.clientName}, all milestones and deliverables for <strong>${data.projectTitle}</strong> have been completed and officially signed off.
                    </p>
                    <p style="margin: 0 0 20px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        You can access all handover files, review warranty details, and share your project feedback through your portal:
                    </p>
                    <div style="margin: 24px 0;">
                        <a href="${data.portalUrl}" style="background-color: #0e6b7e; color: #ffffff; padding: 12px 22px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 14px;">
                            Access Handover Files & Portal &rarr;
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #7a8b98; margin: 24px 0 0;">
                        Optrizo Digital Solutions &bull; Official Project Delivery Record
                    </p>
                </div>
            `,
        });

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending project complete email:", result.error);
            return { success: false, error: result.error };
        }
        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("sendProjectCompleteEmail error:", err);
        return { success: false, error: err };
    }
}

/**
 * Sends an email verification link during client registration.
 */
export async function sendEmailVerificationEmail(data: {
    email: string;
    name: string;
    verifyUrl: string;
}) {
    try {
        const result = await sendMail({
            to: data.email,
            subject: `Verify Your Optrizo Account`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px 20px; color: #14202b;">
                    <div style="margin-bottom: 24px;">
                        <span style="font-size: 18px; font-weight: 700; color: #0e6b7e; letter-spacing: -0.02em;">OPTRIZO</span>
                    </div>
                    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #14202b;">
                        Verify Your Email Address
                    </h2>
                    <p style="margin: 0 0 16px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        Hello ${data.name}, thank you for registering with Optrizo. Please verify your email address to activate your account and access your client portal.
                    </p>
                    <div style="margin: 24px 0;">
                        <a href="${data.verifyUrl}" style="background-color: #0e6b7e; color: #ffffff; padding: 12px 22px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 14px;">
                            Verify Email Address &rarr;
                        </a>
                    </div>
                    <p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">
                        This verification link will expire in 24 hours. If you did not create an account, you can safely ignore this email.
                    </p>
                    <p style="font-size: 12px; color: #7a8b98; margin: 24px 0 0;">
                        Optrizo Digital Solutions &bull; Account Security
                    </p>
                </div>
            `,
        });

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending email verification:", result.error);
            return { success: false, error: result.error };
        }
        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("sendEmailVerificationEmail error:", err);
        return { success: false, error: err };
    }
}

/**
 * Sends a staff invitation email with a 48-hour single-use set-password link.
 */
export async function sendStaffInviteEmail(data: {
    to: string;
    name: string;
    role: string;
    link: string;
}) {
    try {
        const roleLabels: Record<string, string> = {
            sales: "Sales Specialist",
            manager: "Project Manager",
            developer: "Developer",
            content_editor: "Content Editor",
            superadmin: "Super Admin",
        };
        const roleDisplay = roleLabels[data.role] || data.role;

        const result = await sendMail({
            to: data.to,
            subject: `Invitation to join Optrizo as ${roleDisplay}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px 20px; color: #14202b;">
                    <div style="margin-bottom: 24px;">
                        <span style="font-size: 18px; font-weight: 700; color: #0e6b7e; letter-spacing: -0.02em;">OPTRIZO</span>
                    </div>
                    <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #14202b;">
                        You've Been Invited to Join Optrizo
                    </h2>
                    <p style="margin: 0 0 16px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        Hello ${data.name}, you have been invited to join the Optrizo team as a <strong>${roleDisplay}</strong>.
                    </p>
                    <p style="margin: 0 0 20px; font-size: 15px; color: #4b5a67; line-height: 1.5;">
                        Please click the button below to accept your invitation and set your account password:
                    </p>
                    <div style="margin: 24px 0;">
                        <a href="${data.link}" style="background-color: #0e6b7e; color: #ffffff; padding: 12px 22px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 14px;">
                            Accept Invitation &amp; Set Password &rarr;
                        </a>
                    </div>
                    <p style="margin: 16px 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                        This invitation link is valid for 48 hours. If you were not expecting this invitation, you can safely ignore this email.
                    </p>
                    <p style="font-size: 12px; color: #7a8b98; margin: 24px 0 0;">
                        Optrizo Digital Solutions &bull; Staff Account Provisioning
                    </p>
                </div>
            `,
        });

        if (!result.ok && !result.skipped) {
            console.error("Email Error sending staff invite:", result.error);
            return { success: false, error: result.error };
        }
        return { success: true, mock: result.skipped };
    } catch (err) {
        console.error("sendStaffInviteEmail error:", err);
        return { success: false, error: err };
        return { success: false, error: err };
    }
}
