import type { Request, Response } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { Resend } from "resend";
import User from "../models/User.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import env from "../config/env.js";

// type UserRole = "Landlord" | "Tenant";
// const ALLOWED_ROLES: UserRole[] = ["Landlord", "Tenant"];
type UserGender = "Male" | "Female";

const googleClient = new OAuth2Client();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const RESET_OTP_TTL_MINUTES = 10;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const sha256Hex = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeGender = (value: unknown): UserGender | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  return null;
};

const buildResetPasswordEmailHtml = (otpCode: string, resetLink: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password</title>
  </head>
  <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f6f8;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding: 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:10px; padding:30px;">
            <tr>
              <td align="center" style="padding-bottom:20px;">
                <img src="${escapeHtml(env.EMAIL_LOGO_URL || "https://via.placeholder.com/120x40?text=Roombaazi")}" alt="Roombaazi" width="120" />
              </td>
            </tr>
            <tr>
              <td align="center">
                <h2 style="margin:0; color:#333;">Reset Your Password</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 0; color:#555; font-size:15px; text-align:center;">
                We received a request to reset your password.<br />
                Use the OTP below or click the button to continue.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 0;">
                <div style="display:inline-block;background:#f1f5f9;padding:15px 25px;border-radius:8px;font-size:24px;letter-spacing:5px;font-weight:bold;color:#0f172a;">
                  ${escapeHtml(otpCode)}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px;">
                <a href="${escapeHtml(resetLink)}" style="background: linear-gradient(90deg, #0f4c75, #f59e0b);color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:6px;font-size:15px;display:inline-block;">
                  Reset Password
                </a>
              </td>
            </tr>
            <tr>
              <td style="text-align:center; font-size:13px; color:#888;">This OTP will expire in ${RESET_OTP_TTL_MINUTES} minutes.</td>
            </tr>
            <tr>
              <td style="padding-top:30px; text-align:center; font-size:12px; color:#aaa;">
                If you didn't request this, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const generateGooglePhonePlaceholder = (): string => {
  const randomDigits = `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`.slice(-14);
  return `G${randomDigits}`;
};

const sendAuthCookie = (
  res: Response,
  user: { _id: unknown; email?: string | null },
) => {
  const id = String(user._id);
  const email = user.email ?? "";
  // const role = user.role ?? "Tenant";

  const token = jwt.sign({ id, email }, env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: true,
    sameSite: env.NODE_ENV === "production" ? "strict" : "none",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
};

// Helper to check if a MongoDB error is a duplicate key error
const isDuplicateKeyError = (error: unknown): { field: string } | null => {
  if (typeof error !== "object" || error === null) return null;
  const mongoErr = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };
  if (mongoErr.code !== 11000) return null;
  const keys = Object.keys(mongoErr.keyPattern || {});
  return { field: keys[0] || "unknown" };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, phone, password, gender } = req.body as {
    fullName?: unknown;
    email?: unknown;
    phone?: unknown;
    password?: unknown;
    // role?: unknown;
    gender?: unknown;
  };

  if (
    !isNonEmptyString(fullName) ||
    !isNonEmptyString(email) ||
    !isNonEmptyString(phone) ||
    !isNonEmptyString(password)
  ) {
    res
      .status(400)
      .json({ error: "Please provide fullName, email, phone, and password" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = phone.trim();
  const normalizedFullName = fullName.trim();
  // const normalizedRole: UserRole =
  //   typeof role === "string" && ALLOWED_ROLES.includes(role as UserRole)
  //     ? (role as UserRole)
  //     : "Tenant";
  const normalizedGender = normalizeGender(gender);

  if (gender !== undefined && normalizedGender === null) {
    res.status(400).json({ error: "Gender must be Male or Female" });
    return;
  }

  try {
    // Check for existing user
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    }).lean();

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        res.status(409).json({ error: "Email already registered" });
      } else {
        res.status(409).json({ error: "Phone already registered" });
      }
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      // role: normalizedRole,
      gender: normalizedGender ?? undefined,
      isVerified: false,
    });

    sendAuthCookie(res, user);

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        email: user.email,
        gender: user.gender ?? null,
      },
    });
  } catch (error) {
    const dup = isDuplicateKeyError(error);
    if (dup) {
      if (dup.field === "email") {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      if (dup.field === "phone") {
        res.status(409).json({ error: "Phone already registered" });
        return;
      }
      res.status(409).json({ error: "Account already exists" });
      return;
    }

    console.error("Registration Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as {
    email?: unknown;
    password?: unknown;
  };

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json({ error: "Please provide email and password" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const user = await User.findOne({ email: normalizedEmail });
    // console.log("user", user);

    if (!user) {
      res.status(401).json({ error: "Invalid credentials1" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is deactivated" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials2" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid credentials3" });
      return;
    }

    sendAuthCookie(res, user);

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error" });
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
      if (env.BYPASS_RESET_EMAIL) {
        res
          .status(404)
          .json({ error: "No active account found for this email" });
        return;
      }
      res.status(200).json({ message: genericMessage });
      return;
    }

    const otpCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    const resetToken = crypto.randomBytes(32).toString("hex");
    const otpHash = sha256Hex(otpCode);
    const tokenHash = sha256Hex(resetToken);
    const resetLink = `${env.CLIENT_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(
      resetToken,
    )}&email=${encodeURIComponent(user.email)}`;

    // Invalidate previous unused requests
    await PasswordResetRequest.updateMany(
      { userId: user._id, usedAt: null },
      { usedAt: new Date() },
    );

    // Create new reset request
    await PasswordResetRequest.create({
      userId: user._id,
      email: user.email,
      otpHash,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000),
    });

    if (env.BYPASS_RESET_EMAIL) {
      res.status(200).json({
        message: "Email sending is bypassed. Continue to reset password.",
        resetToken,
        email: user.email,
        otpCode,
      });
      return;
    }

    if (!resend || !env.RESEND_FROM_EMAIL) {
      console.error(
        "Forgot password email is not configured: missing RESEND_API_KEY or RESEND_FROM_EMAIL.",
      );
      res.status(500).json({ error: "Email service is not configured" });
      return;
    }

    const sendResult = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: user.email,
      subject: "Reset Your Password",
      html: buildResetPasswordEmailHtml(otpCode, resetLink),
    });

    if (sendResult.error) {
      console.error("Resend send failed:", sendResult.error);
      res.status(500).json({ error: "Unable to send reset email right now" });
      return;
    }

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
      ? sha256Hex((otpCode as string).trim()) === resetRecord.otpHash
      : false;
    const tokenValid = hasToken
      ? sha256Hex((token as string).trim()) === resetRecord.tokenHash
      : false;

    if (!otpValid && !tokenValid) {
      res.status(400).json({ error: "Invalid or expired reset request" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(trimmedPassword, salt);

    await User.updateOne({ _id: user._id }, { passwordHash });

    // Invalidate all pending reset requests for this user
    await PasswordResetRequest.updateMany(
      { userId: user._id, usedAt: null },
      { usedAt: new Date() },
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

    // Check if user exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (!existingUser.isActive) {
        res.status(403).json({ error: "Account is deactivated" });
        return;
      }

      sendAuthCookie(res, existingUser);
      res.status(200).json({
        message: "Google login successful",
        user: {
          id: existingUser._id,
          email: existingUser.email,
          // role: existingUser.role,
          gender: existingUser.gender ?? null,
        },
      });
      return;
    }

    // Create new user
    const createdUser = await User.create({
      fullName,
      email,
      phone: generateGooglePhonePlaceholder(),
      // role: "Tenant",
      isVerified: true,
    });

    sendAuthCookie(res, createdUser);

    res.status(201).json({
      message: "Google signup successful",
      user: {
        id: createdUser._id,
        email: createdUser.email,
        // role: createdUser.role,
        gender: createdUser.gender ?? null,
        
      },
    });
  } catch (error) {
    console.error("Google login Error:", error);
    res.status(401).json({ error: "Google authentication failed" });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const user = await User.findById(req.user.id).lean();

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email ?? null,
        gender: user.gender ?? null,
      },
    });
  } catch (error) {
    console.error("Auth me Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: true,
    sameSite: env.NODE_ENV === "production" ? "strict" : "none",
  });
  res.status(200).json({ message: "Logged out successfully" });
};
