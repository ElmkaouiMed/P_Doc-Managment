import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedKey] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const computed = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  const storedBuffer = Buffer.from(storedKey, "hex");
  const computedBuffer = Buffer.from(computed, "hex");

  if (storedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, computedBuffer);
}
