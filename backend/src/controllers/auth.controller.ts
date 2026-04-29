import type { Request, Response } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import env from "../config/env.js";
import User from "../models/User.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import {
  escapeHtml,
  isNonEmptyString,
  isValidEmail,
  isValidGender,
  isValidPassword,
  normalizeEmail,
  normalizeFullName,
  normalizePhone,
} from "../utils/validators.js";
import {
  ErrorResponses,
  handleDuplicateError,
} from "../utils/errorHelpers.js";
import {
  clearAuthCookie,
  getUserPublicData,
  sendAuthCookie,
} from "../utils/jwtHelpers.js";

const googleClient = new OAuth2Client();
const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});
const RESET_OTP_TTL_MINUTES = 10;
const OTP_RESEND_LIMIT = 3;
const OTP_RESEND_WINDOW_MS = 24 * 60 * 60 * 1000;

const sha256Hex = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const generateGooglePhonePlaceholder = (): string => {
  const randomDigits = `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`.slice(-14);
  return `G${randomDigits}`;
};

const buildVerifyEmailHtml = (verifyLink: string, fullName: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Confirm Your Email – Roombaazi</title>
  </head>
  <body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#f1f5f9;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:48px 0 32px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(15,23,42,0.12);">

            <!-- TOP ACCENT BAR -->
            <tr>
              <td style="background:linear-gradient(90deg,#0f172a,#1e3a5f,#f59e0b,#fb923c,#f59e0b,#1e3a5f,#0f172a);height:5px;font-size:0;line-height:0;">&nbsp;</td>
            </tr>

            <!-- LOGO ON WHITE -->
            <tr>
              <td align="center" style="background:#ffffff;padding:28px 40px 20px;">
                ${env.EMAIL_LOGO_URL
                  ? `<img src="${env.EMAIL_LOGO_URL}" alt="Roombaazi" height="52" style="height:52px;width:auto;max-width:180px;display:block;margin:0 auto;" />`
                  : `<span style="color:#0f172a;font-size:26px;font-weight:900;letter-spacing:-0.5px;font-family:Arial,sans-serif;">Room<span style="color:#f59e0b;">baazi</span></span>`}
              </td>
            </tr>

            <!-- DARK HERO BANNER -->
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0f172a 100%);padding:36px 44px 32px;text-align:center;">
                <p style="margin:0 0 12px;font-size:40px;line-height:1;">🎉</p>
                <h1 style="margin:0 0 10px;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3;">Hi ${escapeHtml(fullName)}, you're almost in!</h1>
                <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">Confirm your email to activate your Roombaazi account</p>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:36px 44px 8px;">
                <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.75;">
                  Thanks for joining Roombaazi! Click the button below to verify your email address and start exploring rooms.
                </p>

                <!-- CTA BUTTON -->
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#f59e0b 0%,#fb923c 100%);box-shadow:0 4px 18px rgba(245,158,11,0.45);">
                      <a href="${escapeHtml(verifyLink)}" target="_blank"
                        style="display:inline-block;padding:15px 48px;color:#0f172a;font-size:16px;font-weight:800;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
                        Confirm My Email &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
                  Link expires in <strong>24 hours</strong> &middot; Didn't sign up? Safely ignore this email.
                </p>
                <p style="margin:0 0 24px;color:#cbd5e1;font-size:11px;text-align:center;word-break:break-all;">${escapeHtml(verifyLink)}</p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="padding:18px 44px 28px;text-align:center;background:#f8fafc;border-top:1px solid #f1f5f9;">
                <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;font-weight:600;">&copy; ${new Date().getFullYear()} Roombaazi &mdash; All rights reserved.</p>
                <p style="margin:0;color:#cbd5e1;font-size:11px;">Finding perfect rooms, made simple.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const buildResetPasswordEmailHtml = (otpCode: string, resetLink: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password – Roombaazi</title>
  </head>
  <body style="margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#f1f5f9;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:48px 0 32px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(15,23,42,0.12);">

            <!-- TOP ACCENT BAR -->
            <tr>
              <td style="background:linear-gradient(90deg,#0f172a,#1e3a5f,#f59e0b,#fb923c,#f59e0b,#1e3a5f,#0f172a);height:5px;font-size:0;line-height:0;">&nbsp;</td>
            </tr>

            <!-- LOGO ON WHITE -->
            <tr>
              <td align="center" style="background:#ffffff;padding:28px 40px 20px;">
                ${env.EMAIL_LOGO_URL
                  ? `<img src="${env.EMAIL_LOGO_URL}" alt="Roombaazi" height="52" style="height:52px;width:auto;max-width:180px;display:block;margin:0 auto;" />`
                  : `<span style="color:#0f172a;font-size:26px;font-weight:900;letter-spacing:-0.5px;font-family:Arial,sans-serif;">Room<span style="color:#f59e0b;">baazi</span></span>`}
              </td>
            </tr>

            <!-- DARK HERO BANNER -->
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0f172a 100%);padding:36px 44px 32px;text-align:center;">
                <p style="margin:0 0 12px;font-size:40px;line-height:1;">🔒</p>
                <h1 style="margin:0 0 10px;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3;">Reset Your Password</h1>
                <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">Use the OTP below or click the button to set a new password</p>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:36px 44px 8px;">
                <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.75;">
                  We received a request to reset your Roombaazi password. Your one-time code is:
                </p>

                <!-- OTP BOX -->
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                  <tr>
                    <td align="center" style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:12px;padding:18px 36px;">
                      <span style="font-size:32px;font-weight:900;letter-spacing:10px;color:#0f172a;font-family:'Courier New',monospace;">${escapeHtml(otpCode)}</span>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 20px;color:#64748b;font-size:13px;text-align:center;">Or click the button below to go directly to the reset page:</p>

                <!-- CTA BUTTON -->
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);box-shadow:0 4px 18px rgba(15,23,42,0.35);">
                      <a href="${escapeHtml(resetLink)}" target="_blank"
                        style="display:inline-block;padding:15px 48px;color:#f59e0b;font-size:16px;font-weight:800;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
                        Reset Password &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
                  OTP expires in <strong>${RESET_OTP_TTL_MINUTES} minutes</strong> &middot; Didn't request this? Safely ignore this email.
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="padding:18px 44px 28px;text-align:center;background:#f8fafc;border-top:1px solid #f1f5f9;">
                <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;font-weight:600;">&copy; ${new Date().getFullYear()} Roombaazi &mdash; All rights reserved.</p>
                <p style="margin:0;color:#cbd5e1;font-size:11px;">Finding perfect rooms, made simple.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

export const register = async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, phone, password, gender } = req.body as {
    fullName?: unknown;
    email?: unknown;
    phone?: unknown;
    password?: unknown;
    gender?: unknown;
  };

  if (!isNonEmptyString(fullName)) {
    ErrorResponses.badRequest(res, "Full name is required");
    return;
  }
  if (!isNonEmptyString(email) || !isValidEmail(email)) {
    ErrorResponses.badRequest(res, "Valid email is required");
    return;
  }
  if (!isNonEmptyString(phone)) {
    ErrorResponses.badRequest(res, "Phone number is required");
    return;
  }
  if (!isNonEmptyString(password) || !isValidPassword(password)) {
    ErrorResponses.badRequest(res, "Password must be at least 6 characters");
    return;
  }
  if (!isValidGender(gender)) {
    ErrorResponses.badRequest(res, "Gender must be Male, Female, or Other");
    return;
  }

  const normalizedFullName = normalizeFullName(fullName);
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  try {
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    }).lean();

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        ErrorResponses.emailExists(res);
        return;
      }

      ErrorResponses.phoneExists(res);
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const verifyToken = sha256Hex(rawToken);
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.create({
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      gender,
      isVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: verifyExpires,
    });

    const verifyLink = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;

    let emailSent = false;
    if (env.SMTP_USER && env.SMTP_PASS) {
      try {
        await mailer.sendMail({
          from: env.EMAIL_FROM || env.SMTP_USER,
          to: normalizedEmail,
          subject: "Confirm your email – Roombaazi",
          html: buildVerifyEmailHtml(verifyLink, normalizedFullName),
        });
        emailSent = true;
      } catch (emailError) {
        console.error("Verification email failed to send:", emailError);
        // Don't fail registration if email send errors — user account is created
      }
    }

    res.status(201).json({
      message: "Registration successful. Please check your email to confirm your account.",
      emailSent,
    });
  } catch (error) {
    if (handleDuplicateError(error, res)) {
      return;
    }

    console.error("Registration Error:", error);
    ErrorResponses.internal(res);
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query as { token?: string };

  if (!token || typeof token !== "string" || !token.trim()) {
    res.status(400).json({ error: "Verification token is required" });
    return;
  }

  const hashedToken = sha256Hex(token.trim());

  try {
    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ error: "Invalid or expired verification link." });
      return;
    }

    user.isVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    const jwtToken = sendAuthCookie(res, user);

    res.status(200).json({
      message: "Email verified successfully",
      token: jwtToken,
      user: getUserPublicData(user),
    });
  } catch (error) {
    console.error("Email Verify Error:", error);
    ErrorResponses.internal(res);
  }
};

export const resendVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: unknown };

  if (!isNonEmptyString(email) || !isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const user = await User.findOne({ email: normalizedEmail, isActive: true });

    // Always return success to avoid email enumeration
    if (!user || user.isVerified) {
      res.status(200).json({ message: "If that email exists and is unverified, a new link has been sent." });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.emailVerifyToken = sha256Hex(rawToken);
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyLink = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;

    if (env.SMTP_USER && env.SMTP_PASS) {
      try {
        await mailer.sendMail({
          from: env.EMAIL_FROM || env.SMTP_USER,
          to: normalizedEmail,
          subject: "Confirm your email – Roombaazi",
          html: buildVerifyEmailHtml(verifyLink, user.fullName),
        });
      } catch (emailError) {
        console.error("Resend verification email failed:", emailError);
      }
    }

    res.status(200).json({ message: "If that email exists and is unverified, a new link has been sent." });
  } catch (error) {
    console.error("Resend Verification Error:", error);
    ErrorResponses.internal(res);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as {
    email?: unknown;
    password?: unknown;
  };

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    ErrorResponses.badRequest(res, "Please provide email and password");
    return;
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.passwordHash) {
      ErrorResponses.invalidCredentials(res);
      return;
    }

    if (!user.isActive) {
      ErrorResponses.accountDeactivated(res);
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      ErrorResponses.invalidCredentials(res);
      return;
    }

    const token = sendAuthCookie(res, user);

    res.status(200).json({
      message: "Login successful",
      token,
      user: getUserPublicData(user),
    });
  } catch (error) {
    console.error("Login Error:", error);
    ErrorResponses.internal(res);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.body as { email?: unknown };

  if (!isNonEmptyString(email)) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const genericMessage =
    "If an account exists for this email, password reset instructions were sent.";

  try {
    const user = await User.findOne({
      email: normalizedEmail,
      isActive: true,
    }).lean();

    if (!user || !user.email) {
      res.status(200).json({ message: genericMessage });
      return;
    }

    const windowStart = user.otpResendWindowStart;
    const windowExpired =
      !windowStart || Date.now() - windowStart.getTime() > OTP_RESEND_WINDOW_MS;

    if (windowExpired) {
      await User.updateOne(
        { _id: user._id },
        { otpResendCount: 1, otpResendWindowStart: new Date() },
      );
    } else if (user.otpResendCount >= OTP_RESEND_LIMIT) {
      const windowEndsAt = new Date(
        windowStart.getTime() + OTP_RESEND_WINDOW_MS,
      );
      const hoursLeft = Math.ceil(
        (windowEndsAt.getTime() - Date.now()) / (60 * 60 * 1000),
      );

      res.status(429).json({
        error: `You have reached the maximum OTP request limit (${OTP_RESEND_LIMIT} requests). Please try again in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}.`,
      });
      return;
    } else {
      await User.updateOne({ _id: user._id }, { $inc: { otpResendCount: 1 } });
    }

    const otpCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    const resetToken = crypto.randomBytes(32).toString("hex");
    const otpHash = sha256Hex(otpCode);
    const tokenHash = sha256Hex(resetToken);
    const resetLink = `${env.CLIENT_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(user.email)}`;

    await PasswordResetRequest.updateMany(
      { userId: user._id, usedAt: null },
      { usedAt: new Date() },
    );

    await PasswordResetRequest.create({
      userId: user._id,
      email: user.email,
      otpHash,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000),
    });

    if (!env.SMTP_USER || !env.SMTP_PASS) {
      console.error("Forgot password email is not configured: missing SMTP_USER or SMTP_PASS.");
      res.status(500).json({ error: "Email service is not configured" });
      return;
    }

    await mailer.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to: user.email,
      subject: "Reset Your Roombaazi Password",
      html: buildResetPasswordEmailHtml(otpCode, resetLink),
    });

    res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password Error:", error);
    res
      .status(500)
      .json({ error: "Unable to process forgot password request" });
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, otpCode, token, newPassword } = req.body as {
    email?: unknown;
    otpCode?: unknown;
    token?: unknown;
    newPassword?: unknown;
  };

  if (!isNonEmptyString(email) || !isNonEmptyString(newPassword)) {
    res.status(400).json({ error: "Email and newPassword are required" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const trimmedPassword = newPassword.trim();
  if (trimmedPassword.length < 6) {
    res
      .status(400)
      .json({ error: "New password must be at least 6 characters" });
    return;
  }

  const hasOtp = isNonEmptyString(otpCode);
  const hasToken = isNonEmptyString(token);
  if (!hasOtp && !hasToken) {
    res.status(400).json({ error: "Provide either otpCode or token" });
    return;
  }

  try {
    const user = await User.findOne({
      email: normalizedEmail,
      isActive: true,
    }).lean();
    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset request" });
      return;
    }

    const resetRecord = await PasswordResetRequest.findOne({
      email: normalizedEmail,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!resetRecord) {
      res.status(400).json({ error: "Invalid or expired reset request" });
      return;
    }

    const otpValid = hasOtp
      ? sha256Hex(otpCode.trim()) === resetRecord.otpHash
      : false;
    const tokenValid = hasToken
      ? sha256Hex(token.trim()) === resetRecord.tokenHash
      : false;

    if (!otpValid && !tokenValid) {
      res.status(400).json({ error: "Invalid or expired reset request" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(trimmedPassword, salt);

    await User.updateOne({ _id: user._id }, { passwordHash });
    await PasswordResetRequest.updateMany(
      { userId: user._id, usedAt: null },
      { usedAt: new Date() },
    );
    await User.updateOne(
      { _id: user._id },
      { otpResendCount: 0, otpResendWindowStart: null },
    );

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password Error:", error);
    res.status(500).json({ error: "Unable to reset password" });
  }
};

export const googleLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { idToken } = req.body as { idToken?: unknown };

  if (!isNonEmptyString(idToken)) {
    res.status(400).json({ error: "Google ID token is required" });
    return;
  }

  if (!isNonEmptyString(env.GOOGLE_CLIENT_ID)) {
    res.status(500).json({ error: "Server Google auth is not configured" });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email ? normalizeEmail(payload.email) : "";
    const fullName = payload?.name?.trim() || "Google User";

    if (!email) {
      res.status(400).json({ error: "Google account email is unavailable" });
      return;
    }

    if (!payload?.email_verified) {
      res.status(401).json({ error: "Google email is not verified" });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (!existingUser.isActive) {
        res.status(403).json({ error: "Account is deactivated" });
        return;
      }

      const token = sendAuthCookie(res, existingUser);
      res.status(200).json({
        message: "Google login successful",
        token,
        user: getUserPublicData(existingUser),
      });
      return;
    }

    const createdUser = await User.create({
      fullName,
      email,
      phone: generateGooglePhonePlaceholder(),
      isVerified: true,
    });

    const token = sendAuthCookie(res, createdUser);
    res.status(201).json({
      message: "Google signup successful",
      token,
      user: getUserPublicData(createdUser),
    });
  } catch (error) {
    console.error("Google login Error:", error);
    res.status(401).json({ error: "Google authentication failed" });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    ErrorResponses.unauthorized(res);
    return;
  }

  try {
    const user = await User.findById(req.user.id).lean();

    if (!user || !user.isActive) {
      ErrorResponses.unauthorized(res);
      return;
    }

    res.status(200).json({ user: getUserPublicData(user) });
  } catch (error) {
    console.error("Auth me Error:", error);
    ErrorResponses.internal(res);
  }
};

export const logout = (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.status(200).json({ message: "Logged out successfully" });
};