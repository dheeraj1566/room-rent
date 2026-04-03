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
} as const;

export default env;
