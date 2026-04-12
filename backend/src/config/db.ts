import sql from "mssql";

const AUTO_DISCONNECT_MS = 2 * 60 * 1000; // 2 minutes of inactivity → close pool

const dbConfig: sql.config = {
  server: process.env.DB_SERVER || "",
  database: process.env.DB_NAME || "",
  user: process.env.DB_USER || "",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    encrypt: true, // Required for Azure SQL
    trustServerCertificate: false,
    connectTimeout: 30000, // Increase timeout to 30s
  },
  pool: {
    max: 3, // Reduced from 10 — free tier doesn't need many connections
    min: 0,
    idleTimeoutMillis: 15000, // Close idle connections faster (15s vs 30s)
  },
};

let pool: sql.ConnectionPool | null = null;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Resets the auto-disconnect timer. Called every time the pool is accessed.
 * After AUTO_DISCONNECT_MS of no activity, the pool is closed to save
 * Azure SQL free-tier compute minutes.
 */
const resetDisconnectTimer = () => {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
  }
  disconnectTimer = setTimeout(async () => {
    if (pool) {
      console.log("💤 Auto-closing SQL pool after inactivity");
      try {
        await pool.close();
      } catch {
        // Ignore close errors
      }
      pool = null;
    }
    disconnectTimer = null;
  }, AUTO_DISCONNECT_MS);
};

export const getPool = async (): Promise<sql.ConnectionPool> => {
  if (!pool || !pool.connected) {
    pool = await sql.connect(dbConfig);
    console.log("✅ Connected to Azure SQL Server");
  }
  resetDisconnectTimer();
  return pool;
};

export const closePool = async (): Promise<void> => {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (pool) {
    await pool.close();
    pool = null;
    console.log("🔌 SQL Server connection closed");
  }
};

/* Adding a DB wrapper to detect DB Wakes */

let dbWakeCount = 0;
let lastDbAccessTime: number | null = null;

export async function executeQuery(query: string) {
  const now = Date.now();

  // Detect DB wake (idle → active)
  if (!lastDbAccessTime || now - lastDbAccessTime > 2 * 60 * 1000) {
    dbWakeCount++;
    console.log("🔥 DB WAKE DETECTED");
    console.log("🕒 Time:", new Date().toISOString());
    console.log("📊 Total wakes:", dbWakeCount);
    console.log("➡️ Route:", (global as any).currentRoute);
  }

  lastDbAccessTime = now;

  // Log which route triggered it
  console.log("📡 DB QUERY EXECUTED");

  const pool = await getPool();
  return pool.request().query(query);
}

export default { getPool, closePool, executeQuery };
