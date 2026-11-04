import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer, { type Transporter } from "nodemailer";
import { sendMail, resetMailerTransportForTesting } from "@/lib/mailer";

vi.mock("nodemailer");

describe("mailer: sendMail unit tests", () => {
  const originalEnv = { ...process.env };
  const mockSendMail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMailerTransportForTesting();
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: "mock-msg-123" });
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail: mockSendMail,
    } as unknown as Transporter);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetMailerTransportForTesting();
  });

  it("skips sending and returns { ok: false, skipped: true } without throwing when config is missing", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendMail({
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({ ok: false, skipped: true });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mailer] Incomplete SMTP configuration")
    );

    warnSpy.mockRestore();
  });

  it("skips sending if SMTP_PORT is not a valid number", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "not-a-number";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_FROM = "sender@example.com";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendMail({
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({ ok: false, skipped: true });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[mailer] Invalid SMTP_PORT")
    );

    warnSpy.mockRestore();
  });

  it("successfully creates transport with secure=true for port 465 and returns { ok: true }", async () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "test@gmail.com";
    process.env.SMTP_PASS = "app-password";
    process.env.SMTP_FROM = "Optrizo CRM <test@gmail.com>";

    const result = await sendMail({
      to: "client@example.com",
      subject: "Welcome",
      html: "<p>Welcome to Optrizo</p>",
      text: "Welcome to Optrizo",
    });

    expect(result).toEqual({ ok: true });
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "test@gmail.com",
        pass: "app-password",
      },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: "Optrizo CRM <test@gmail.com>",
      to: "client@example.com",
      subject: "Welcome",
      html: "<p>Welcome to Optrizo</p>",
      text: "Welcome to Optrizo",
    });
  });

  it("sets secure=false when port is not 465 (e.g. 587)", async () => {
    process.env.SMTP_HOST = "smtp.mailgun.org";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "test@mailgun.org";
    process.env.SMTP_PASS = "app-password";
    process.env.SMTP_FROM = "Optrizo CRM <test@mailgun.org>";

    const result = await sendMail({
      to: "client@example.com",
      subject: "Notification",
      html: "<p>Notice</p>",
    });

    expect(result).toEqual({ ok: true });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 587,
        secure: false,
      })
    );
  });

  it("reuses cached transporter across multiple sendMail calls", async () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "test@gmail.com";
    process.env.SMTP_PASS = "app-password";
    process.env.SMTP_FROM = "Optrizo CRM <test@gmail.com>";

    await sendMail({ to: "1@example.com", subject: "1", html: "1" });
    await sendMail({ to: "2@example.com", subject: "2", html: "2" });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it("returns { ok: false, error } without throwing when nodemailer throws an error", async () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "test@gmail.com";
    process.env.SMTP_PASS = "app-password";
    process.env.SMTP_FROM = "Optrizo CRM <test@gmail.com>";

    const networkError = new Error("Connection refused (ECONNREFUSED)");
    mockSendMail.mockRejectedValueOnce(networkError);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendMail({
      to: "fail@example.com",
      subject: "Error Test",
      html: "<p>Fail</p>",
    });

    expect(result).toEqual({ ok: false, error: networkError });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send email: Connection refused (ECONNREFUSED)")
    );

    errorSpy.mockRestore();
  });
});

