import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path configured via env variable or defaulting to root ecas.db
const DB_PATH = process.env.DATABASE_FILE || path.resolve(__dirname, "../../ecas.db");

let dbInstance = null;

/**
 * Get or initialize SQLite Database connection
 */
export function getDatabase() {
  if (dbInstance) return dbInstance;

  try {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    dbInstance = new DatabaseSync(DB_PATH);
    // Enable WAL mode and foreign keys for high reliability and relational integrity
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");

    // Execute schema
    const schemaPath = path.resolve(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    dbInstance.exec(schemaSql);

    console.log(`[ECAS Database] Connected successfully to SQLite at: ${DB_PATH}`);
    return dbInstance;
  } catch (error) {
    console.error(`[ECAS Database] Critical connection failure for ${DB_PATH}:`, error.message);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Verify database connectivity with health check
 */
export function verifyDatabaseConnection() {
  try {
    const db = getDatabase();
    const result = db.prepare("SELECT 1 AS healthy").get();
    const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get();
    const electiveCount = db.prepare("SELECT COUNT(*) AS count FROM electives").get();

    return {
      connected: true,
      engine: "SQLite (node:sqlite)",
      path: DB_PATH,
      healthy: result?.healthy === 1,
      stats: {
        users: userCount?.count || 0,
        electives: electiveCount?.count || 0,
      },
    };
  } catch (err) {
    return {
      connected: false,
      engine: "SQLite (node:sqlite)",
      path: DB_PATH,
      error: err.message,
    };
  }
}

/**
 * Execute a transaction safely with rollback on error
 */
export function runTransaction(callback) {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE TRANSACTION;");
  try {
    const result = callback(db);
    db.exec("COMMIT;");
    return result;
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

/**
 * Password hashing utility using SHA-256 with cryptographic salt
 */
export function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

export function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}
