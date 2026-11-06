import "dotenv/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_KEY_ENV = "ENDPOINT_SECRET_ENCRYPTION_KEY";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const FORMAT_VERSION = "v1";

function getEncryptionKey(): Buffer {
  const encodedKey = process.env[ENCRYPTION_KEY_ENV];

  if (!encodedKey) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be set to encrypt endpoint secrets.`);
  }

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32 || key.toString("base64") !== encodedKey) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be a base64-encoded 32-byte key.`);
  }

  return key;
}

function decodeBase64(value: string): Buffer {
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new Error("Invalid encrypted endpoint secret.");
  }
  return decoded;
}

export function encryptEndpointSecret(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new TypeError("Endpoint secret must be a string.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64")
  ].join(":");
}

export function decryptEndpointSecret(encryptedSecret: string): string {
  const parts = encryptedSecret.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Invalid encrypted endpoint secret.");
  }

  const iv = decodeBase64(parts[1]);
  const authTag = decodeBase64(parts[2]);
  const ciphertext = decodeBase64(parts[3]);
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted endpoint secret.");
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Endpoint secret could not be decrypted.");
  }
}
