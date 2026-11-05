import { createHash, randomBytes } from "node:crypto";

export function generateApiKey(): string {
  return `relay_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export function isWellFormedApiKey(apiKey: string): boolean {
  return /^relay_[A-Za-z0-9_-]{43}$/.test(apiKey);
}
