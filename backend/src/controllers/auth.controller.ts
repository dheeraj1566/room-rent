import type { Request, Response } from "express";
import crypto from "node:crypto";
import sql from "mssql";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { Resend } from "resend";
import db from "../config/db.js";
import env from "../config/env.js";

type AuthUserRecord = {
  UserId: string;
  Email: string | null;
  Role: string | null;
  Gender?: string | null;
};

type UserRole = "Landlord" | "Tenant";
const ALLOWED_ROLES: UserRole[] = ["Landlord", "Tenant"];
type UserGender = "Male" | "Female";

let usersHasGenderColumnCache: boolean | null = null;
const googleClient = new OAuth2Client();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const RESET_OTP_TTL_MINUTES = 10;
let resetTableEnsured = false;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const sha256Hex = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

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

const usersHasGenderColumn = async (): Promise<boolean> => {
  if (usersHasGenderColumnCache !== null) return usersHasGenderColumnCache;
  const pool = await db.getPool();
  const result = await pool.request().query(`
    SELECT 1 AS found
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'Gender'
  `);
  usersHasGenderColumnCache = result.recordset.length > 0;
  return usersHasGenderColumnCache;
};

const extractSqlMessage = (error: unknown): string => {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  const maybeMessage = (error as { message?: unknown }).message;
  return typeof maybeMessage === "string" ? maybeMessage : "";
};

const ensurePasswordResetTable = async (): Promise<void> => {
  if (resetTableEnsured) return;
  const pool = await db.getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.PasswordResetRequests', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.PasswordResetRequests (
        ResetId INT IDENTITY(1,1) PRIMARY KEY,
        UserId UNIQUEIDENTIFIER NOT NULL,
        Email VARCHAR(255) NOT NULL,
        OtpHash CHAR(64) NOT NULL,
        TokenHash CHAR(64) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        UsedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_PasswordResetRequests_Email ON dbo.PasswordResetRequests (Email);
      CREATE INDEX IX_PasswordResetRequests_UserId ON dbo.PasswordResetRequests (UserId);
    END
  `);
  resetTableEnsured = true;
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

const sendAuthCookie = (res: Response, user: AuthUserRecord) => {
  const email = user.Email ?? "";
  const role = user.Role ?? "Tenant";

  const token = jwt.sign(
    { id: user.UserId, email, role },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, phone, password, role, gender } = req.body as {
    fullName?: unknown;
    email?: unknown;
    phone?: unknown;
    password?: unknown;
    role?: unknown;
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
  const normalizedRole: UserRole =
    typeof role === "string" && ALLOWED_ROLES.includes(role as UserRole)
      ? (role as UserRole)
      : "Tenant";
  const normalizedGender = normalizeGender(gender);

  if (gender !== undefined && normalizedGender === null) {
    res.status(400).json({ error: "Gender must be Male or Female" });
    return;
  }

  try {
    const pool = await db.getPool();

    const userExists = await pool
      .request()
      .input("Email", sql.VarChar, normalizedEmail)
      .input("Phone", sql.VarChar, normalizedPhone)
      .query(
        "SELECT UserId, Email, Phone FROM dbo.Users WHERE Email = @Email OR Phone = @Phone"
      );

    if (userExists.recordset.length > 0) {
      const duplicateUser = userExists.recordset[0] as {
        Email: string | null;
        Phone: string;
      };
      if (duplicateUser.Email === normalizedEmail) {
        res.status(409).json({ error: "Email already registered" });
      } else {
        res.status(409).json({ error: "Phone already registered" });
      }
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const hasGenderColumn = await usersHasGenderColumn();
    const request = pool
      .request()
      .input("FullName", sql.NVarChar, normalizedFullName)
      .input("Email", sql.VarChar, normalizedEmail)
      .input("Phone", sql.VarChar, normalizedPhone)
      .input("PasswordHash", sql.VarChar, passwordHash)
      .input("Role", sql.VarChar, normalizedRole);

    const insertColumns = ["FullName", "Email", "Phone", "PasswordHash", "Role", "IsVerified"];
    const insertValues = ["@FullName", "@Email", "@Phone", "@PasswordHash", "@Role", "0"];
    const outputColumns = ["INSERTED.UserId", "INSERTED.Email", "INSERTED.Role"];

    if (hasGenderColumn) {
      insertColumns.push("Gender");
      insertValues.push("@Gender");
      outputColumns.push("INSERTED.Gender");
      request.input("Gender", sql.VarChar, normalizedGender);
    }

    const result = await request.query(`
      INSERT INTO dbo.Users (${insertColumns.join(", ")})
      OUTPUT ${outputColumns.join(", ")}
      VALUES (${insertValues.join(", ")})
    `);

    const user = result.recordset[0] as AuthUserRecord;
    sendAuthCookie(res, user);

    res.status(201).json({
      message: "Registration successful",
      user: { id: user.UserId, email: user.Email, role: user.Role, gender: user.Gender ?? null },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "number" in error &&
      (error as { number?: number }).number !== undefined
    ) {
      const sqlError = error as { number: number };
      if (sqlError.number === 2627 || sqlError.number === 2601) {
        const sqlMessage = extractSqlMessage(error);

        if (sqlMessage.includes("UQ_Users_Email")) {
          res.status(409).json({ error: "Email already registered" });
          return;
        }

        if (sqlMessage.includes("UQ_Users_Phone")) {
          res.status(409).json({ error: "Phone already registered" });
          return;
        }

        if (sqlMessage.includes("UQ_Users_AadhaarHash")) {
          res.status(500).json({
            error:
              "Registration blocked by database constraint UQ_Users_AadhaarHash. Apply the nullable unique-index fix and try again.",
          });
          return;
        }

        res.status(409).json({ error: "Account already exists" });
        return;
      }
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
    const pool = await db.getPool();

    const result = await pool
      .request()
      .input("Email", sql.VarChar, normalizedEmail)
      .query(`
        SELECT UserId, Email, PasswordHash, Role, IsActive
        FROM dbo.Users
        WHERE Email = @Email
      `);

    if (result.recordset.length === 0) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const user = result.recordset[0];

    if (!user.IsActive) {
      res.status(403).json({ error: "Account is deactivated" });
      return;
    }

    if (!user.PasswordHash || typeof user.PasswordHash !== "string") {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    sendAuthCookie(res, user);

    res.status(200).json({
      message: "Login successful",
      user: { id: user.UserId, email: user.Email, role: user.Role },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: unknown };
  if (!isNonEmptyString(email)) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const genericMessage =
    "If an account exists for this email, password reset instructions were sent.";

  try {
    await ensurePasswordResetTable();
    const pool = await db.getPool();
    const result = await pool
      .request()
      .input("Email", sql.VarChar, normalizedEmail)
      .query(`
        SELECT TOP 1 UserId, Email, IsActive
        FROM dbo.Users
        WHERE Email = @Email
      `);

    if (result.recordset.length === 0 || !result.recordset[0].IsActive) {
      if (env.BYPASS_RESET_EMAIL) {
        res.status(404).json({ error: "No active account found for this email" });
        return;
      }
      res.status(200).json({ message: genericMessage });
      return;
    }

    const user = result.recordset[0] as { UserId: string; Email: string | null };
    if (!user.Email) {
      if (env.BYPASS_RESET_EMAIL) {
        res.status(404).json({ error: "No active account found for this email" });
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
      resetToken
    )}&email=${encodeURIComponent(user.Email)}`;

    await pool
      .request()
      .input("UserId", sql.UniqueIdentifier, user.UserId)
      .query(`UPDATE dbo.PasswordResetRequests SET UsedAt = SYSUTCDATETIME() WHERE UserId = @UserId AND UsedAt IS NULL`);

    await pool
      .request()
      .input("UserId", sql.UniqueIdentifier, user.UserId)
      .input("Email", sql.VarChar, user.Email)
      .input("OtpHash", sql.Char(64), otpHash)
      .input("TokenHash", sql.Char(64), tokenHash)
      .input("ExpiryMinutes", sql.Int, RESET_OTP_TTL_MINUTES)
      .query(`
        INSERT INTO dbo.PasswordResetRequests (UserId, Email, OtpHash, TokenHash, ExpiresAt)
        VALUES (@UserId, @Email, @OtpHash, @TokenHash, DATEADD(MINUTE, @ExpiryMinutes, SYSUTCDATETIME()))
      `);

    if (env.BYPASS_RESET_EMAIL) {
      res.status(200).json({
        message: "Email sending is bypassed. Continue to reset password.",
        resetToken,
        email: user.Email,
        otpCode,
      });
      return;
    }

    if (!resend || !env.RESEND_FROM_EMAIL) {
      console.error(
        "Forgot password email is not configured: missing RESEND_API_KEY or RESEND_FROM_EMAIL."
      );
      res.status(500).json({ error: "Email service is not configured" });
      return;
    }

    const sendResult = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: user.Email,
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
    res.status(500).json({ error: "Unable to process forgot password request" });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
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
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const hasOtp = isNonEmptyString(otpCode);
  const hasToken = isNonEmptyString(token);
  if (!hasOtp && !hasToken) {
    res.status(400).json({ error: "Provide either otpCode or token" });
    return;
  }

  try {
    await ensurePasswordResetTable();
    const pool = await db.getPool();
    const userResult = await pool
      .request()
      .input("Email", sql.VarChar, normalizedEmail)
      .query(`
        SELECT TOP 1 UserId
        FROM dbo.Users
        WHERE Email = @Email AND IsActive = 1
      `);

    if (userResult.recordset.length === 0) {
      res.status(400).json({ error: "Invalid or expired reset request" });
      return;
    }

    const requestRecordResult = await pool
      .request()
      .input("Email", sql.VarChar, normalizedEmail)
      .query(`
        SELECT TOP 1 ResetId, UserId, OtpHash, TokenHash
        FROM dbo.PasswordResetRequests
        WHERE Email = @Email
          AND UsedAt IS NULL
          AND ExpiresAt > SYSUTCDATETIME()
        ORDER BY CreatedAt DESC
      `);

    if (requestRecordResult.recordset.length === 0) {
      res.status(400).json({ error: "Invalid or expired reset request" });
      return;
    }

    const requestRecord = requestRecordResult.recordset[0] as {
      ResetId: number;
      UserId: string;
      OtpHash: string;
      TokenHash: string;
    };

    const otpValid = hasOtp ? sha256Hex((otpCode as string).trim()) === requestRecord.OtpHash : false;
    const tokenValid = hasToken ? sha256Hex((token as string).trim()) === requestRecord.TokenHash : false;

    if (!otpValid && !tokenValid) {
      res.status(400).json({ error: "Invalid or expired reset request" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(trimmedPassword, salt);

    await pool
      .request()
      .input("UserId", sql.UniqueIdentifier, requestRecord.UserId)
      .input("PasswordHash", sql.VarChar, passwordHash)
      .query(`
        UPDATE dbo.Users
        SET PasswordHash = @PasswordHash
        WHERE UserId = @UserId
      `);

    await pool
      .request()
      .input("UserId", sql.UniqueIdentifier, requestRecord.UserId)
      .query(`UPDATE dbo.PasswordResetRequests SET UsedAt = SYSUTCDATETIME() WHERE UserId = @UserId AND UsedAt IS NULL`);

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password Error:", error);
    res.status(500).json({ error: "Unable to reset password" });
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
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

    const pool = await db.getPool();
    const hasGenderColumn = await usersHasGenderColumn();

    const existingUserResult = await pool
      .request()
      .input("Email", sql.VarChar, email)
      .query(`
        SELECT UserId, Email, Role, IsActive${hasGenderColumn ? ", Gender" : ""}
        FROM dbo.Users
        WHERE Email = @Email
      `);

    if (existingUserResult.recordset.length > 0) {
      const existingUser = existingUserResult.recordset[0] as AuthUserRecord & {
        IsActive: boolean;
      };

      if (!existingUser.IsActive) {
        res.status(403).json({ error: "Account is deactivated" });
        return;
      }

      sendAuthCookie(res, existingUser);
      res.status(200).json({
        message: "Google login successful",
        user: {
          id: existingUser.UserId,
          email: existingUser.Email,
          role: existingUser.Role,
          gender: existingUser.Gender ?? null,
        },
      });
      return;
    }

    const request = pool
      .request()
      .input("FullName", sql.NVarChar, fullName)
      .input("Email", sql.VarChar, email)
      .input("Phone", sql.VarChar, generateGooglePhonePlaceholder())
      .input("Role", sql.VarChar, "Tenant");

    const insertColumns = ["FullName", "Email", "Phone", "Role", "IsVerified"];
    const insertValues = ["@FullName", "@Email", "@Phone", "@Role", "1"];
    const outputColumns = ["INSERTED.UserId", "INSERTED.Email", "INSERTED.Role"];

    if (hasGenderColumn) {
      insertColumns.push("Gender");
      insertValues.push("NULL");
      outputColumns.push("INSERTED.Gender");
    }

    const createdResult = await request.query(`
      INSERT INTO dbo.Users (${insertColumns.join(", ")})
      OUTPUT ${outputColumns.join(", ")}
      VALUES (${insertValues.join(", ")})
    `);

    const createdUser = createdResult.recordset[0] as AuthUserRecord;
    sendAuthCookie(res, createdUser);

    res.status(201).json({
      message: "Google signup successful",
      user: {
        id: createdUser.UserId,
        email: createdUser.Email,
        role: createdUser.Role,
        gender: createdUser.Gender ?? null,
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
    const pool = await db.getPool();
    const hasGenderColumn = await usersHasGenderColumn();
    const selectColumns = ["UserId", "Email", "Role", "IsActive"];
    if (hasGenderColumn) {
      selectColumns.push("Gender");
    }
    const result = await pool
      .request()
      .input("UserId", sql.UniqueIdentifier, req.user.id)
      .query(`
        SELECT ${selectColumns.join(", ")}
        FROM dbo.Users
        WHERE UserId = @UserId
      `);

    if (result.recordset.length === 0 || !result.recordset[0].IsActive) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = result.recordset[0] as AuthUserRecord;
    res.status(200).json({
      user: { id: user.UserId, email: user.Email, role: user.Role, gender: user.Gender ?? null },
    });
  } catch (error) {
    console.error("Auth me Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.COOKIE_SAME_SITE,
  });
  res.status(200).json({ message: "Logged out successfully" });
};
