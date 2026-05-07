import type { Request, Response } from "express";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import { CryptoService } from "../services/crypto.service.js";
import env from "../config/env.js";
import { isValidEmail } from "../utils/validators.js";

const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

const sha256Hex = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const buildVerifyEmailHtml = (verifyLink: string, fullName: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Confirm Your New Email – Roombaazi</title>
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
                <p style="margin:0 0 12px;font-size:40px;line-height:1;">✉️</p>
                <h1 style="margin:0 0 10px;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3;">Confirm your new email, ${fullName}</h1>
                <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">Verify your updated email address to keep your account secure</p>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:36px 44px 8px;">
                <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.75;">
                  You recently changed the email on your Roombaazi account. Click the button below to verify your new address.
                </p>

                <!-- CTA BUTTON -->
                <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#f59e0b 0%,#fb923c 100%);box-shadow:0 4px 18px rgba(245,158,11,0.45);">
                      <a href="${verifyLink}" target="_blank"
                        style="display:inline-block;padding:15px 48px;color:#0f172a;font-size:16px;font-weight:800;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
                        Verify Email &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
                  Link expires in <strong>24 hours</strong> &middot; Didn't make this change? Safely ignore this email.
                </p>
                <p style="margin:0 0 24px;color:#cbd5e1;font-size:11px;text-align:center;word-break:break-all;">${verifyLink}</p>
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

type ProfilePayload = {
  fullName?: unknown;
  email?: unknown;
  location?: unknown;
  aadhaar?: unknown;
  phone?: unknown;
  photo?: unknown;
  photoUrl?: unknown;
  gender?: unknown;
};

const trimStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const hasOwn = (payload: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(payload, key);

const normalizeEmail = (value: string | null): string | null =>
  value ? value.toLowerCase() : null;

// Helper to check if a MongoDB error is a duplicate key error
const isDuplicateKeyError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  return (error as { code?: number }).code === 11000;
};

const toEncryptedBuffer = (value: unknown): Buffer | null => {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);

  if (typeof value === "object") {
    const candidate = value as {
      value?: () => Uint8Array;
      buffer?: Uint8Array;
      sub_type?: number;
      $binary?: { base64?: string };
    };

    if (typeof candidate.value === "function") {
      try {
        const normalized = candidate.value();
        if (normalized instanceof Uint8Array) return Buffer.from(normalized);
      } catch {
        // Fall through to other representations.
      }
    }

    if (candidate.buffer instanceof Uint8Array) {
      return Buffer.from(candidate.buffer);
    }

    const base64 = candidate.$binary?.base64;
    if (typeof base64 === "string" && base64.length > 0) {
      return Buffer.from(base64, "base64");
    }
  }

  return null;
};

const getProfileByUserId = async (userId: string) => {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  return {
    id: user._id,
    fullName: user.fullName ?? null,
    email: user.email ?? null,
    location: user.permanentAddress ?? null,
    aadhaar: (() => {
      const encryptedBuffer = toEncryptedBuffer(user.aadhaarEncrypted);
      if (!encryptedBuffer || encryptedBuffer.length === 0) return null;

      const rawUtf8 = encryptedBuffer.toString("utf8").trim();
      if (/^\d{12}$/.test(rawUtf8)) {
        // Backward compatibility for records where plain Aadhaar digits were
        // accidentally stored as binary instead of encrypted payload.
        return rawUtf8.slice(-4);
      }
      
      try {
        // Return only last 4 digits — never expose full Aadhaar to client
        const decrypted = CryptoService.decrypt(encryptedBuffer);
        if (!/^\d{12}$/.test(decrypted)) return null;
        return decrypted.slice(-4);
      } catch (error) {
        console.error('Failed to decrypt Aadhaar:', error);
        return null;
      }
    })(),
    phone: (() => {
      const p = user.phone ?? null;
      // Strip Google signup phone placeholder (starts with 'G' followed by digits)
      if (p && /^G\d+$/.test(p)) return null;
      return p;
    })(),
    photo: user.photoUrl ?? null,
    gender: user.gender ?? null,
  };
};

const saveProfile = async (
  userId: string,
  payload: ProfilePayload
): Promise<{ emailSent: boolean }> => {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");

  const updates: Record<string, unknown> = {};

  // Full name
  const fullName = trimStringOrNull(payload.fullName);
  if (fullName !== null) {
    updates.fullName = fullName;
  }

  // Email
  const email = normalizeEmail(trimStringOrNull(payload.email));
  if (hasOwn(payload as object, "email") && email !== null) {
    if (!isValidEmail(email)) {
      ErrorResponses.badRequest(res, "Valid email is required");
      return { emailSent: false };
    }

    const existingEmail = normalizeEmail(user.email ?? null);
    const emailChanged = email !== existingEmail;

    if (emailChanged) {
      // New email → unverify and generate new token
      const rawToken = crypto.randomBytes(32).toString("hex");
      updates.email = email;
      updates.isVerified = false;
      updates.emailVerifyToken = sha256Hex(rawToken);
      updates.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      // Store raw token so we can send it after save
      (updates as Record<string, unknown>).__rawVerifyToken = rawToken;
    } else if (!user.isVerified) {
      // Same email but not verified → resend verification
      const rawToken = crypto.randomBytes(32).toString("hex");
      updates.emailVerifyToken = sha256Hex(rawToken);
      updates.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      (updates as Record<string, unknown>).__rawVerifyToken = rawToken;
    }
    // Same email + already verified → do nothing
  }

  // Location / Address
  const location = trimStringOrNull(payload.location);
  if (hasOwn(payload as object, "location") && location !== null) {
    updates.permanentAddress = location;
  }

  // Aadhaar
  const aadhaar = trimStringOrNull(payload.aadhaar);
  if (aadhaar !== null && !/^\d{12}$/.test(aadhaar)) {
    throw new Error("VALIDATION_AADHAAR");
  }
  if (hasOwn(payload as object, "aadhaar") && aadhaar !== null) {
    // Aadhaar is immutable once set
    if (user.aadhaarEncrypted) {
      throw new Error("IMMUTABLE_AADHAAR");
    }
    // Encrypt Aadhaar and create hash for uniqueness checking
    const { encrypted, hash } = CryptoService.encryptWithHash(aadhaar);
    updates.aadhaarEncrypted = encrypted;
    updates.aadhaarHash = hash;
  }

  // Phone
  const phone = trimStringOrNull(payload.phone);
  if (hasOwn(payload as object, "phone") && phone !== null) {
    updates.phone = phone;
  }

  // Photo
  const photo =
    trimStringOrNull(payload.photoUrl) ?? trimStringOrNull(payload.photo);
  if (
    (hasOwn(payload as object, "photoUrl") || hasOwn(payload as object, "photo")) &&
    photo !== null
  ) {
    updates.photoUrl = photo;
  }

  // Gender
  const gender = trimStringOrNull(payload.gender);
  if (hasOwn(payload as object, "gender") && gender !== null) {
    const normalizedGender = gender.toLowerCase();
    if (normalizedGender !== "male" && normalizedGender !== "female" && normalizedGender !== "other") {
      throw new Error("VALIDATION_GENDER");
    }
    const genderMap: Record<string, "Male" | "Female" | "Other"> = { male: "Male", female: "Female", other: "Other" };
    updates.gender = genderMap[normalizedGender];
  }

  if (Object.keys(updates).length === 0) {
    return { emailSent: false };
  }

  // Extract the raw token before saving (it must not be stored in DB as-is)
  const rawVerifyToken = (updates as Record<string, unknown>).__rawVerifyToken as string | undefined;
  delete (updates as Record<string, unknown>).__rawVerifyToken;

  await User.updateOne({ _id: userId }, { $set: updates });

  // Send verification email if needed
  let emailSent = false;
  if (rawVerifyToken && env.SMTP_USER && env.SMTP_PASS) {
    const targetEmail = (updates.email as string | undefined) ?? user.email;
    const name = (updates.fullName as string | undefined) ?? user.fullName ?? "there";
    const verifyLink = `${env.CLIENT_URL}/verify-email?token=${rawVerifyToken}`;
    try {
      await mailer.sendMail({
        from: env.EMAIL_FROM || env.SMTP_USER,
        to: targetEmail,
        subject: "Confirm your email – Roombaazi",
        html: buildVerifyEmailHtml(verifyLink, name),
      });
      emailSent = true;
    } catch (err) {
      console.error("Profile verify email send failed:", err);
    }
  }

  return { emailSent };
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const profile = await getProfileByUserId(req.user.id);
    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json({ profile });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { emailSent } = await saveProfile(req.user.id, req.body as ProfilePayload);
    const profile = await getProfileByUserId(req.user.id);
    res.status(201).json({ message: "Profile saved", profile, emailSent });
  } catch (error) {
    if (error instanceof Error && error.message === "VALIDATION_AADHAAR") {
      res.status(400).json({ error: "Aadhaar must be exactly 12 digits" });
      return;
    }
    if (error instanceof Error && error.message === "VALIDATION_GENDER") {
      res.status(400).json({ error: "Gender must be Male, Female, or Other" });
      return;
    }
    if (error instanceof Error && error.message === "IMMUTABLE_AADHAAR") {
      res.status(400).json({ error: "Aadhaar cannot be changed once saved" });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ error: "Email, phone, or Aadhaar already in use" });
      return;
    }
    console.error("Create profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { emailSent } = await saveProfile(req.user.id, req.body as ProfilePayload);
    const profile = await getProfileByUserId(req.user.id);
    res.status(200).json({ message: "Profile updated", profile, emailSent });
  } catch (error) {
    if (error instanceof Error && error.message === "VALIDATION_AADHAAR") {
      res.status(400).json({ error: "Aadhaar must be exactly 12 digits" });
      return;
    }
    if (error instanceof Error && error.message === "VALIDATION_GENDER") {
      res.status(400).json({ error: "Gender must be Male, Female, or Other" });
      return;
    }
    if (error instanceof Error && error.message === "IMMUTABLE_AADHAAR") {
      res.status(400).json({ error: "Aadhaar cannot be changed once saved" });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ error: "Email, phone, or Aadhaar already in use" });
      return;
    }
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
