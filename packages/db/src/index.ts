import { Prisma, PrismaClient } from "@prisma/client";

import { getRequiredSetting } from "@rent/config";
import type { PropertyInput, UserInput } from "@rent/shared";

let prisma: PrismaClient | null = null;

export class DuplicateUserError extends Error {
  readonly statusCode = 409;

  constructor(conflicts?: string[]) {
    const conflictFields = conflicts && conflicts.length > 0 ? conflicts.join(", ") : "unique fields";
    super(`User already exists with the same ${conflictFields}.`);
    this.name = "DuplicateUserError";
  }
}

export class UserNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(userId: string) {
    super(`User not found for userId: ${userId}`);
    this.name = "UserNotFoundError";
  }
}

export class PropertyNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(propertyId: string) {
    super(`Property not found for propertyId: ${propertyId}`);
    this.name = "PropertyNotFoundError";
  }
}

function getDbClient() {
  const configuredDatabaseUrl = getRequiredSetting("DATABASE_URL");
  process.env.DATABASE_URL = configuredDatabaseUrl;

  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

export type DbClient = PrismaClient;

export function createDb(): DbClient {
  return getDbClient();
}

export async function pingDb() {
  const db = getDbClient();
  return db.$queryRaw`SELECT 1 AS ok`;
}

function getConflictFields(existing: { userEmail: string; phone: string; aadhaarNumber: string }, user: UserInput) {
  const conflicts: string[] = [];

  if (existing.userEmail === user.userEmail) conflicts.push("email");
  if (existing.phone === user.phone) conflicts.push("phone");
  if (existing.aadhaarNumber === user.aadhaarNumber) conflicts.push("aadhaarNumber");

  return conflicts;
}

export async function getUserById(userId: string) {
  const db = getDbClient();

  const user = await db.Users.findUnique({
    where: { userId },
    select: {
      userId: true,
      userName: true,
      phone: true,
      userEmail: true,
      aadhaarNumber: true,
      localAddress: true,
      hometownAddress: true,
      profilePhotoUrl: true,
      isActive: true,
      createdAt: true,
      createdBy: true,
      updatedAt: true,
      updatedBy: true
    }
  });

  if (!user) {
    throw new UserNotFoundError(userId);
  }

  return user;
}

export async function saveUser(user: UserInput) {
  const db = getDbClient();

  const existing = await db.Users.findFirst({
    where: {
      OR: [{ userEmail: user.userEmail }, { phone: user.phone }, { aadhaarNumber: user.aadhaarNumber }]
    },
    select: { userEmail: true, phone: true, aadhaarNumber: true }
  });

  if (existing) {
    throw new DuplicateUserError(getConflictFields(existing, user));
  }

  try {
    await db.Users.create({
      data: {
        userName: user.userName,
        phone: user.phone,
        userEmail: user.userEmail,
        aadhaarNumber: user.aadhaarNumber,
        localAddress: user.localAddress,
        hometownAddress: user.hometownAddress,
        profilePhotoUrl: user.profilePhotoUrl,
        isActive: true
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateUserError(["email, phone, or aadhaarNumber"]);
    }
    throw error;
  }
}

export async function updateUser(userId: string, user: UserInput) {
  const db = getDbClient();

  const existingUser = await db.Users.findUnique({
    where: { userId },
    select: { userId: true }
  });

  if (!existingUser) {
    throw new UserNotFoundError(userId);
  }

  const conflictingUser = await db.Users.findFirst({
    where: {
      userId: { not: userId },
      OR: [{ userEmail: user.userEmail }, { phone: user.phone }, { aadhaarNumber: user.aadhaarNumber }]
    },
    select: { userEmail: true, phone: true, aadhaarNumber: true }
  });

  if (conflictingUser) {
    throw new DuplicateUserError(getConflictFields(conflictingUser, user));
  }

  try {
    await db.Users.update({
      where: { userId },
      data: {
        userName: user.userName,
        phone: user.phone,
        userEmail: user.userEmail,
        aadhaarNumber: user.aadhaarNumber,
        localAddress: user.localAddress,
        hometownAddress: user.hometownAddress,
        profilePhotoUrl: user.profilePhotoUrl,
        isActive: true
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new DuplicateUserError(["email, phone, or aadhaarNumber"]);
      }
      if (error.code === "P2025") {
        throw new UserNotFoundError(userId);
      }
    }
    throw error;
  }
}

type PropertyRecord = {
  id: string;
  userId: string;
  propertyName: string;
  address: string;
  latitude: number;
  longitude: number;
  isActive: boolean | null;
  createdAt: Date | null;
};

export async function createProperty(property: PropertyInput) {
  const db = getDbClient();

  await db.$executeRaw`
    INSERT INTO [dbo].[Properties] ([UserId], [PropertyName], [Address], [Latitude], [Longitude], [IsActive], [CreatedAt])
    VALUES (${property.userId}, ${property.propertyName}, ${property.address}, ${property.latitude}, ${property.longitude}, 1, GETUTCDATE())
  `;
}

export async function listProperties(userId?: string) {
  const db = getDbClient();
  const filterByUser = userId ? Prisma.sql`AND [UserId] = ${userId}` : Prisma.empty;

  return db.$queryRaw<PropertyRecord[]>`
    SELECT
      [Id] AS id,
      [UserId] AS userId,
      [PropertyName] AS propertyName,
      [Address] AS address,
      [Latitude] AS latitude,
      [Longitude] AS longitude,
      [IsActive] AS isActive,
      [CreatedAt] AS createdAt
    FROM [dbo].[Properties]
    WHERE [IsActive] = 1
    ${filterByUser}
    ORDER BY [CreatedAt] DESC
  `;
}

export async function getPropertyById(propertyId: string) {
  const db = getDbClient();

  const rows = await db.$queryRaw<PropertyRecord[]>`
    SELECT
      [Id] AS id,
      [UserId] AS userId,
      [PropertyName] AS propertyName,
      [Address] AS address,
      [Latitude] AS latitude,
      [Longitude] AS longitude,
      [IsActive] AS isActive,
      [CreatedAt] AS createdAt
    FROM [dbo].[Properties]
    WHERE [Id] = ${propertyId} AND [IsActive] = 1
  `;

  const property = rows[0];

  if (!property) {
    throw new PropertyNotFoundError(propertyId);
  }

  return property;
}

export async function editProperty(propertyId: string, property: PropertyInput) {
  const db = getDbClient();

  const affectedRows = await db.$executeRaw`
    UPDATE [dbo].[Properties]
    SET
      [UserId] = ${property.userId},
      [PropertyName] = ${property.propertyName},
      [Address] = ${property.address},
      [Latitude] = ${property.latitude},
      [Longitude] = ${property.longitude},
      [IsActive] = 1
    WHERE [Id] = ${propertyId} AND [IsActive] = 1
  `;

  if (affectedRows === 0) {
    throw new PropertyNotFoundError(propertyId);
  }
}

export async function softDeleteProperty(propertyId: string) {
  const db = getDbClient();

  const affectedRows = await db.$executeRaw`
    UPDATE [dbo].[Properties]
    SET [IsActive] = 0
    WHERE [Id] = ${propertyId} AND [IsActive] = 1
  `;

  if (affectedRows === 0) {
    throw new PropertyNotFoundError(propertyId);
  }
}