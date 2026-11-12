import { afterEach, describe, expect, it } from "vitest";
import {
  createOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode,
} from "./two-factor";

const originalEncryptionKey = process.env.TOTP_ENCRYPTION_KEY;

afterEach(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.TOTP_ENCRYPTION_KEY;
  } else {
    process.env.TOTP_ENCRYPTION_KEY = originalEncryptionKey;
  }
});

describe("staff two-factor helpers", () => {
  it("verifies RFC 6238 codes and rejects replayed or malformed codes", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const now = 59_000;

    expect(verifyTotpCode(secret, "287082", now)).toBe(1);
    expect(verifyTotpCode(secret, "287082", now, 1)).toBeNull();
    expect(verifyTotpCode(secret, "28708", now)).toBeNull();
  });

  it("encrypts secrets with the configured key and rejects tampering", () => {
    process.env.TOTP_ENCRYPTION_KEY = "a".repeat(64);
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    const [version, iv, tag, ciphertext] = encrypted.split(".");

    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptTotpSecret(encrypted)).toBe("JBSWY3DPEHPK3PXP");
    const changedTag = `${tag?.[0] === "A" ? "B" : "A"}${tag?.slice(1)}`;
    expect(() => decryptTotpSecret([version, iv, changedTag, ciphertext].join("."))).toThrow(
      "Secret TOTP tidak dapat didekripsi.",
    );
  });

  it("requires a valid key and creates unique, hashed recovery codes", () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    expect(() => encryptTotpSecret("JBSWY3DPEHPK3PXP")).toThrow("TOTP_ENCRYPTION_KEY wajib");

    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(hashRecoveryCode(codes[0] ?? "")).toMatch(/^[\da-f]{64}$/u);
    expect(hashRecoveryCode("not a recovery code")).toBe("");
  });

  it("creates compatible authenticator URIs and high-entropy secrets", () => {
    const secret = generateTotpSecret();
    const uri = createOtpAuthUri("owner@example.test", "PETORA INDONESIA", secret);

    expect(secret).toMatch(/^[A-Z2-7]{32}$/u);
    expect(uri).toContain("otpauth://totp/PETORA%20INDONESIA:owner%40example.test?");
    expect(uri).toContain(`secret=${secret}`);
  });
});
