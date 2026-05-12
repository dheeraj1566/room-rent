import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import env from "../config/env.js";
import EmailLog from "../models/EmailLog.js";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  purpose:
    | "register_verification"
    | "resend_verification"
    | "forgot_password"
    | "profile_email_verification";
  relatedUserId?: string;
  metadata?: Record<string, unknown>;
};

export class EmailService {
  static isConfigured(): boolean {
    return Boolean(env.SMTP_USER && env.SMTP_PASS);
  }

  static async send(input: SendEmailInput): Promise<{ success: boolean; skipped: boolean }> {
    const from = env.EMAIL_FROM || env.SMTP_USER || "unconfigured";

    if (!this.isConfigured()) {
      await EmailLog.create({
        provider: "nodemailer-smtp",
        purpose: input.purpose,
        from,
        to: input.to,
        subject: input.subject,
        status: "skipped",
        errorMessage: "SMTP credentials are not configured",
        ...(input.relatedUserId ? { relatedUserId: input.relatedUserId } : {}),
        metadata: input.metadata,
      });

      return { success: false, skipped: true };
    }

    try {
      const result = (await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      })) as SMTPTransport.SentMessageInfo;

      await EmailLog.create({
        provider: "nodemailer-smtp",
        purpose: input.purpose,
        from,
        to: input.to,
        subject: input.subject,
        status: "sent",
        providerMessageId: typeof result.messageId === "string" ? result.messageId : undefined,
        acceptedRecipients: Array.isArray(result.accepted) ? result.accepted.map(String) : [],
        rejectedRecipients: Array.isArray(result.rejected) ? result.rejected.map(String) : [],
        ...(input.relatedUserId ? { relatedUserId: input.relatedUserId } : {}),
        metadata: input.metadata,
      });

      return { success: true, skipped: false };
    } catch (error) {
      await EmailLog.create({
        provider: "nodemailer-smtp",
        purpose: input.purpose,
        from,
        to: input.to,
        subject: input.subject,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown email delivery error",
        ...(input.relatedUserId ? { relatedUserId: input.relatedUserId } : {}),
        metadata: input.metadata,
      });

      throw error;
    }
  }

  static async getSummary() {
    const [totals] = await EmailLog.aggregate<{
      total: number;
      sent: number;
      failed: number;
      skipped: number;
    }>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: {
            $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          skipped: {
            $sum: { $cond: [{ $eq: ["$status", "skipped"] }, 1, 0] },
          },
        },
      },
    ]);

    return totals ?? { total: 0, sent: 0, failed: 0, skipped: 0 };
  }

  static async getRecent(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      EmailLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailLog.countDocuments(),
    ]);

    return { items, total };
  }
}

export default EmailService;
