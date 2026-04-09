import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const backendEnvPath = path.resolve(currentDir, "../../.env");

const loadEnvFile = (filePath: string) => {
  if (!existsSync(filePath)) return;

  const fileContents = readFileSync(filePath, "utf8");
  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(backendEnvPath);

export const env = {
  PORT: parseInt(process.env.PORT || "5000"),
  NODE_ENV: process.env.NODE_ENV || "development",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",

  // Database
  DB_SERVER: process.env.DB_SERVER || "",
  DB_NAME: process.env.DB_NAME || "",
  DB_USER: process.env.DB_USER || "",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_PORT: parseInt(process.env.DB_PORT || "1433"),

  // External APIs
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "",
  EMAIL_LOGO_URL: process.env.EMAIL_LOGO_URL || "",
  BYPASS_RESET_EMAIL: process.env.BYPASS_RESET_EMAIL === "true",

  // Azure Blob Storage
  AZURE_STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
  AZURE_STORAGE_ACCOUNT_KEY: process.env.AZURE_STORAGE_ACCOUNT_KEY || "",
  AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME || "uploads",
  AZURE_STORAGE_CONNECTION_STRING:
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    (process.env.AZURE_STORAGE_PUBLIC_BASE_URL?.startsWith("DefaultEndpointsProtocol=")
      ? process.env.AZURE_STORAGE_PUBLIC_BASE_URL
      : ""),

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "default_development_secret_key_change_in_prod",
  COOKIE_SAME_SITE:
    (process.env.COOKIE_SAME_SITE?.toLowerCase() === "strict"
      ? "strict"
      : process.env.COOKIE_SAME_SITE?.toLowerCase() === "none"
        ? "none"
        : "lax") as "lax" | "strict" | "none",
} as const;

export default env;
