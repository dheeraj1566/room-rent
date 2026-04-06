import type { Request, Response } from "express";
import sql from "mssql";
import db from "../config/db.js";

type UserColumnMap = {
  fullName: string | null;
  email: string | null;
  location: string | null;
  aadhaar: string | null;
  phone: string | null;
  photo: string | null;
};

type ProfilePayload = {
  fullName?: unknown;
  email?: unknown;
  location?: unknown;
  aadhaar?: unknown;
  phone?: unknown;
  photo?: unknown;
  photoUrl?: unknown;
};

const columnCandidates: Record<keyof UserColumnMap, string[]> = {
  fullName: ["FullName", "Name"],
  email: ["Email"],
  location: ["PermanentAddress", "Address", "City", "State", "Location"],
  aadhaar: [
    "Aadhaar",
    "AadhaarNumber",
    "AadhaarNo",
    "AadhaarEncrypted",
    "AadhaarHash",
    "Aadhar",
    "AadharNumber",
    "AadharNo",
    "AadharEncrypted",
    "AadharHash",
  ],
  phone: ["Phone", "PhoneNumber", "Mobile", "MobileNumber"],
  photo: ["ProfilePhotoUrl", "PhotoUrl", "AvatarUrl", "ProfileImageUrl", "Photo"],
};

let resolvedColumnMap: UserColumnMap | null = null;
let resolvedColumnTypes: Record<string, string> | null = null;

const trimStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const hasOwn = (payload: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(payload, key);

const normalizeEmail = (value: string | null): string | null =>
  value ? value.toLowerCase() : null;

const resolveUserColumns = async (): Promise<UserColumnMap> => {
  if (resolvedColumnMap) return resolvedColumnMap;

  const pool = await db.getPool();
  const result = await pool.request().query(`
    SELECT COLUMN_NAME AS columnName, DATA_TYPE AS dataType
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Users'
  `);

  const available = new Map(
    result.recordset.map((row: { columnName: string; dataType: string }) => [
      row.columnName,
      row.dataType.toLowerCase(),
    ])
  );
  resolvedColumnTypes = Object.fromEntries(available.entries());

  const isTextDataType = (dataType: string): boolean =>
    ["char", "nchar", "varchar", "nvarchar", "text", "ntext"].includes(dataType);

  const mapColumn = (key: keyof UserColumnMap): string | null => {
    for (const column of columnCandidates[key]) {
      const dataType = available.get(column);
      if (!dataType) continue;
      if (key === "location" && !isTextDataType(dataType)) continue;
      return column;
    }
    return null;
  };

  resolvedColumnMap = {
    fullName: mapColumn("fullName"),
    email: mapColumn("email"),
    location: mapColumn("location"),
    aadhaar: mapColumn("aadhaar"),
    phone: mapColumn("phone"),
    photo: mapColumn("photo"),
  };

  return resolvedColumnMap;
};

const getProfileByUserId = async (userId: string) => {
  const columns = await resolveUserColumns();
  const pool = await db.getPool();
  const req = pool.request();
  req.input("UserId", sql.UniqueIdentifier, userId);

  const selectParts: string[] = [];
  if (columns.fullName) selectParts.push(`[${columns.fullName}] AS fullName`);
  if (columns.email) selectParts.push(`[${columns.email}] AS email`);
  if (columns.location) selectParts.push(`[${columns.location}] AS location`);
  if (columns.aadhaar) {
    const aadhaarType = resolvedColumnTypes?.[columns.aadhaar] || "";
    if (aadhaarType === "varbinary" || aadhaarType === "binary") {
      selectParts.push(`CONVERT(varchar(20), [${columns.aadhaar}]) AS aadhaar`);
    } else {
      selectParts.push(`[${columns.aadhaar}] AS aadhaar`);
    }
  }
  if (columns.phone) selectParts.push(`[${columns.phone}] AS phone`);
  if (columns.photo) selectParts.push(`[${columns.photo}] AS photo`);

  const sqlText = `
    SELECT UserId${selectParts.length ? ", " : ""}${selectParts.join(", ")}
    FROM dbo.Users
    WHERE UserId = @UserId
  `;

  const result = await req.query(sqlText);
  if (!result.recordset.length) return null;

  const row = result.recordset[0] as {
    UserId: string;
    fullName?: string | null;
    email?: string | null;
    location?: string | null;
    aadhaar?: string | null;
    phone?: string | null;
    photo?: string | null;
  };

  return {
    id: row.UserId,
    fullName: row.fullName ?? null,
    email: row.email ?? null,
    location: row.location ?? null,
    aadhaar: row.aadhaar ?? null,
    phone: row.phone ?? null,
    photo: row.photo ?? null,
  };
};

const saveProfile = async (
  userId: string,
  payload: ProfilePayload
): Promise<void> => {
  const columns = await resolveUserColumns();
  const updates: string[] = [];
  const request = (await db.getPool()).request();
  request.input("UserId", sql.UniqueIdentifier, userId);

  const fullName = trimStringOrNull(payload.fullName);
  if (columns.fullName && fullName !== null) {
    updates.push(`[${columns.fullName}] = @FullName`);
    request.input("FullName", sql.NVarChar(200), fullName);
  }

  const email = normalizeEmail(trimStringOrNull(payload.email));
  if (columns.email && email !== null) {
    updates.push(`[${columns.email}] = @Email`);
    request.input("Email", sql.VarChar(255), email);
  }

  const location = trimStringOrNull(payload.location);
  if (columns.location !== null && hasOwn(payload as object, "location") && location !== null) {
    updates.push(`[${columns.location}] = @Location`);
    request.input("Location", sql.NVarChar(255), location);
  }

  const aadhaar = trimStringOrNull(payload.aadhaar);
  if (aadhaar !== null && !/^\d{12}$/.test(aadhaar)) {
    throw new Error("VALIDATION_AADHAAR");
  }
  if (hasOwn(payload as object, "aadhaar") && aadhaar !== null) {
    const aadhaarPlainParam = "AadhaarPlain";
    request.input(aadhaarPlainParam, sql.VarChar(20), aadhaar);

    const encryptedColumn = ["AadhaarEncrypted", "AadharEncrypted"].find(
      (name) => resolvedColumnTypes?.[name]
    );
    const hashColumn = ["AadhaarHash", "AadharHash"].find(
      (name) => resolvedColumnTypes?.[name]
    );

    if (encryptedColumn) {
      updates.push(`[${encryptedColumn}] = CONVERT(varbinary(512), @${aadhaarPlainParam})`);
    } else if (columns.aadhaar !== null) {
      const aadhaarType = resolvedColumnTypes?.[columns.aadhaar] || "";
      if (aadhaarType === "varbinary" || aadhaarType === "binary") {
        updates.push(`[${columns.aadhaar}] = CONVERT(varbinary(512), @${aadhaarPlainParam})`);
      } else {
        updates.push(`[${columns.aadhaar}] = @${aadhaarPlainParam}`);
      }
    }

    if (hashColumn) {
      updates.push(`[${hashColumn}] = HASHBYTES('SHA2_256', @${aadhaarPlainParam})`);
    }
  }

  const phone = trimStringOrNull(payload.phone);
  if (columns.phone && phone !== null) {
    updates.push(`[${columns.phone}] = @Phone`);
    request.input("Phone", sql.VarChar(20), phone);
  }

  const photo =
    trimStringOrNull(payload.photoUrl) ?? trimStringOrNull(payload.photo);
  if (
    columns.photo !== null &&
    (hasOwn(payload as object, "photoUrl") || hasOwn(payload as object, "photo")) &&
    photo !== null
  ) {
    updates.push(`[${columns.photo}] = @Photo`);
    request.input("Photo", sql.NVarChar(sql.MAX), photo);
  }

  if (!updates.length) {
    return;
  }

  await request.query(`
    UPDATE dbo.Users
    SET ${updates.join(", ")}
    WHERE UserId = @UserId
  `);
};

const isUniqueConstraintError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const maybeNumber = (error as { number?: unknown }).number;
  return maybeNumber === 2627 || maybeNumber === 2601;
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
    await saveProfile(req.user.id, req.body as ProfilePayload);
    const profile = await getProfileByUserId(req.user.id);
    res.status(201).json({ message: "Profile saved", profile });
  } catch (error) {
    if (error instanceof Error && error.message === "VALIDATION_AADHAAR") {
      res.status(400).json({ error: "Aadhaar must be exactly 12 digits" });
      return;
    }
    if (isUniqueConstraintError(error)) {
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
    await saveProfile(req.user.id, req.body as ProfilePayload);
    const profile = await getProfileByUserId(req.user.id);
    res.status(200).json({ message: "Profile updated", profile });
  } catch (error) {
    if (error instanceof Error && error.message === "VALIDATION_AADHAAR") {
      res.status(400).json({ error: "Aadhaar must be exactly 12 digits" });
      return;
    }
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: "Email, phone, or Aadhaar already in use" });
      return;
    }
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
