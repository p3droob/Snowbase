import { decrypt, encrypt } from "./crypto.js";
import { createHash } from "crypto";
import { readFile, writeFile, appendFile, copyFile } from "node:fs/promises";
import { join } from "path";

/**
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function hash(path) {
  const fileBuffer = await readFile(path);
  return createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * Converts a value to a stable JSON string
 * @param {any} value - Value to convert
 * @returns {Promise<string>} - Stable JSON string
 */
export async function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${(await Promise.all(value.map((v) => stableStringify(v)))).join(",")}]`;
  }

  const keys = Object.keys(value).sort();

  return `{${Promise.all(
    keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(","),
  )}}`;
}
/**
 * Normalizes a chunk of data
 * @param {string|Object} chunk - Chunk to normalize
 * @returns {Promise<{raw: Object, stable: string}>} - Normalized chunk
 */
export async function normalize(chunk) {
  const obj = typeof chunk === "string" ? JSON.parse(chunk) : chunk;

  return {
    raw: obj,
    stable: await stableStringify(obj),
  };
}
/**
 * Splits a path like "user/name/first" into ["user", "name", "first"] for nested access
 * @param {string|undefined|Function} path - Path to parse
 * @param {function} error - Error callback
 * @returns {Promise<string[]>} - Array of path parts
 */
export async function parsePath(path, error) {
  if (path == null || path === "") {
    error("[INVALID_PATH] Invalid path");
    return [];
  }
  if (typeof path !== "string") {
    error("[INVALID_PATH] Path must be a string");
    return [];
  }
  const parts = path.split("/").filter(Boolean);
  const forbidden = new Set(["prototype", "__proto__", "constructor"]); //protecting against prototype pollution
  if (parts.some((part) => forbidden.has(part)))
    error("[FORBIDDEN_KEY] Path contains forbidden key");
  if (parts.some((part) => part.includes(".")))
    error("[INVALID_PATH] Path parts cannot contain dots");
  if (parts.length === 0) error("[INVALID_PATH] Path is empty (just /)");
  return parts;
}

/**
 * Reads the database file
 * @param {string} path - Database file path
 * @param {function} error - Error callback
 * @param {boolean} encryption - Is encryption enabled
 * @param {string} [secret] - Encryption secret
 * @returns {Promise<Record<string, any>>} - Parsed database data
 */
export async function read(path, error, encryption, secret) {
  const raw = await readFile(path, "utf8");
  let data;
  try {
    data = encryption ? decrypt(raw, secret || "") : JSON.parse(raw);
  } catch {
    error(
      "[INVALID_DATA] Database file contains invalid JSON or invalid encryption",
    );
  }

  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    error("[INVALID_DATA] Database root must be an object");
  }

  //validate dangerous keys
  const forbidden = new Set(["prototype", "__proto__", "constructor"]);
  /** @param {Record<string, any>} obj */
  const hasForbiddenKey = (obj) => {
    for (const key of Object.keys(obj)) {
      if (forbidden.has(key)) {
        error("[FORBIDDEN_KEY] Database contains forbidden key: " + key);
      }
      if (typeof obj[key] === "object" && obj[key] !== null) {
        hasForbiddenKey(obj[key]);
      }
    }
  };

  hasForbiddenKey(data);
  return data;
}

/**
 * Logs an operation
 * @param {string} operation - Operation to log
 * @param {Record<string, any>|undefined} details - Details of the operation
 * @param {string|undefined} logsPath - Path to log file
 * @param {function} emit - Emit event
 * @param {boolean} logging - Enable logging
 * @returns {Promise<string>} - Timestamp
 */
export async function log(operation, details, logsPath, emit, logging) {
  let timestamp = new Date().toISOString();
  if (!logging) {
    await emit(operation, details ? details : undefined, timestamp);
    return timestamp;
  }
  if (!logsPath) {
    await emit(operation, details ? details : undefined, timestamp);
    return timestamp;
  }
  if (!details)
    await appendFile(logsPath, `[${timestamp}] ${operation}\n`, "utf8");
  if (operation) {
    switch (operation) {
      case "get":
        await appendFile(
          logsPath,
          `[${timestamp}] ${operation} - Path: ${details?.path || "/"}\n`,
          "utf8",
        );
        break;
      case "remove":
        await appendFile(
          logsPath,
          `[${timestamp}] ${operation} - Path: ${details?.path || "/"}\n`,
          "utf8",
        );
        break;
      case "set":
        await appendFile(
          logsPath,
          `[${timestamp}] ${operation} - Path: ${details?.path || "/"}\n`,
          "utf8",
        );
        break;
      case "clear":
        await appendFile(
          logsPath,
          `[${timestamp}] ${operation} - Cleared all data\n`,
          "utf8",
        );
        break;
    }
  }
  emit(operation, details ? details : undefined, timestamp);
  return timestamp;
}

/**
 * Gets a target value from the data by path
 * @param {Record<string, any>} data - Data to search in
 * @param {string} path - Path to get target from
 * @param {function} error - Error callback
 * @returns {Promise<any>} - Found value or undefined
 */
export async function getTargetFromData(data, path, error) {
  const parts = await parsePath(path, error);
  let current = data;

  for (const part of parts) {
    if (
      current == null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, part)
    ) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Writes data to the database file
 * @param {string} path - Database file path
 * @param {Record<string, any>} data - Data to write
 * @param {function} error - Error callback
 * @param {function} emit - Emit event
 * @param {boolean} encryption - Is encryption enabled
 * @param {string|undefined} secret - Encryption secret
 */
export async function write(path, data, error, emit, encryption, secret) {
  let content = "";
  try {
    content = encryption
      ? encrypt(data, secret || "")
      : await stableStringify(data);
  } catch {
    await error("[INVALID_DATA] Data must be JSON serializable or encryptable");
  }

  await writeFile(path, content, "utf8");
  emit("_write", data, new Date().toISOString());
}

export function randomId5() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";

  for (let i = 0; i < 5; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }

  return id;
}