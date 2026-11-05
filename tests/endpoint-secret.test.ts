import { afterEach, describe, expect, it } from "vitest";
import { decryptEndpointSecret, encryptEndpointSecret } from "../src/utils/endpoint-secret";

const keyVariable = "ENDPOINT_SECRET_ENCRYPTION_KEY";
const originalKey = process.env[keyVariable];

afterEach(() => {
  if (originalKey === undefined) delete process.env[keyVariable];
  else process.env[keyVariable] = originalKey;
});

describe("endpoint secret encryption", () => {
  it("round-trips authenticated AES-256-GCM ciphertext", () => {
    process.env[keyVariable] = Buffer.alloc(32, 4).toString("base64");
    const encrypted = encryptEndpointSecret("signing secret");
    expect(encrypted).not.toContain("signing secret");
    expect(decryptEndpointSecret(encrypted)).toBe("signing secret");
  });

  it("rejects tampering and missing or invalid encryption keys", () => {
    process.env[keyVariable] = Buffer.alloc(32, 4).toString("base64");
    const [version, iv, tag, ciphertext] = encryptEndpointSecret("signing secret").split(":");
    expect(() => decryptEndpointSecret([version, iv, tag, `${ciphertext}A`].join(":"))).toThrow();

    delete process.env[keyVariable];
    expect(() => encryptEndpointSecret("secret")).toThrow(/must be set/);
    process.env[keyVariable] = "not-a-key";
    expect(() => encryptEndpointSecret("secret")).toThrow(/32-byte key/);
  });
});
