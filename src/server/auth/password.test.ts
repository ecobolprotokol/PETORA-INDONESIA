import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("staff password hashing", () => {
  it("verifies the correct password without storing it as the hash", async () => {
    const password = "petora-password-aman";
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("kata-sandi-yang-salah", hash)).resolves.toBe(false);
  });

  it("uses a unique salt and rejects malformed hashes", async () => {
    const first = await hashPassword("kata-sandi-aman-pertama");
    const second = await hashPassword("kata-sandi-aman-pertama");

    expect(first).not.toBe(second);
    await expect(verifyPassword("kata-sandi-aman-pertama", "not-a-password-hash")).resolves.toBe(
      false,
    );
  });
});
