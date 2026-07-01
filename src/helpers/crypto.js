import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from "crypto";
import { stableStringify } from "./utils.js";

/**
 * @param {string} password
 * @param {Buffer} salt
 * @returns {Buffer}
 */
export function getKey(password, salt) {
  return scryptSync(password, salt, 32);
}

/**
 * @param {any} data
 * @param {string} secret
 * @returns {string}
 */
export function encrypt(data, secret) {
  const iv = randomBytes(12);
  const salt = randomBytes(16);
  const key = getKey(secret, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(stableStringify(data), "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return JSON.stringify({
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

/**
 * @param {string} raw
 * @param {string} secret
 * @returns {any}
 */
export function decrypt(raw, secret) {
  const payload = JSON.parse(raw);

  const salt = Buffer.from(payload.salt, "base64");
  const key = getKey(secret, salt);

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
