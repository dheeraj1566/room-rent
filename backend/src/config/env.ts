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

  // Database (MongoDB Atlas)
  MONGODB_URI: process.env.MONGODB_URI || "",

  // External APIs
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  // Email (Nodemailer SMTP)
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587"),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "",
  EMAIL_LOGO_URL: process.env.EMAIL_LOGO_URL || "",

  // Azure Blob Storage
  AZURE_STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
  AZURE_STORAGE_ACCOUNT_KEY: process.env.AZURE_STORAGE_ACCOUNT_KEY || "",
  AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME || "uploads",
  AZURE_STORAGE_CONNECTION_STRING:
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    (process.env.AZURE_STORAGE_PUBLIC_BASE_URL?.startsWith("DefaultEndpointsProtocol=")
      ? process.env.AZURE_STORAGE_PUBLIC_BASE_URL
      : ""),

  SERVER_URL: process.env.SERVER_URL || `http://localhost:${parseInt(process.env.PORT || "5000")}`,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "default_development_secret_key_change_in_prod",
  
  // Watermark Configuration
  WATERMARK_TEXT: process.env.WATERMARK_TEXT || "Roombaazi",
  WATERMARK_OPACITY: parseFloat(process.env.WATERMARK_OPACITY || "0.4"),
  WATERMARK_POSITION: (process.env.WATERMARK_POSITION || "bottom-right") as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center',
  WATERMARK_COLOR: process.env.WATERMARK_COLOR || "#FFFFFF",
  WATERMARK_ENABLED: process.env.WATERMARK_ENABLED !== "false",

  // Cloudinary Configuration
  CLOUDINARY_ENABLED: process.env.CLOUDINARY_ENABLED === "true",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || "uploads",

  // Encryption Configuration (for sensitive data like Aadhaar)
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "",
  ENCRYPTION_IV_LENGTH: process.env.ENCRYPTION_IV_LENGTH || "16",
  ENCRYPTION_ALGORITHM: process.env.ENCRYPTION_ALGORITHM || "aes-256-cbc",
} as const;

export default env;
