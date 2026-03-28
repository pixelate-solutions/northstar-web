import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret = process.env.GOOGLE_SYNC_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new Error("GOOGLE_SYNC_ENCRYPTION_SECRET is required for connected accounts.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const [ivHex, tagHex, encryptedHex] = value.split(".");
  if (!ivHex || !tagHex || !encryptedHex) {
    return null;
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
