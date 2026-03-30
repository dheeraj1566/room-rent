import { PrismaClient } from "@prisma/client";

import { getRequiredSetting } from "@rent/config";
import type { UserInput } from "@rent/shared";

let prisma: PrismaClient | null = null;

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

export async function saveUser(user: UserInput) {
  const db = getDbClient();

  await db.user.create({
    data: {
      aadhaarNumber: user.aadhaarNumber,
      name: user.name,
      phone: user.phone,
      email: user.email,
      localAddress: user.localAddress,
      hometownAddress: user.hometownAddress,
      profilePhotoUrl: user.profilePhotoUrl
    }
  });
}