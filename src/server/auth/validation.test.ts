import { describe, expect, it } from "vitest";
import {
  loginSchema,
  setupSchema,
  totpEnrollmentConfirmationSchema,
  totpLoginChallengeSchema,
} from "./validation";

describe("authentication input validation", () => {
  it("normalizes email and rejects short passwords", () => {
    expect(
      loginSchema.safeParse({ email: " OWNER@EXAMPLE.COM ", password: "kata-sandi-aman" }),
    ).toMatchObject({ success: true, data: { email: "owner@example.com" } });
    expect(loginSchema.safeParse({ email: "owner@example.com", password: "pendek" }).success).toBe(
      false,
    );
  });

  it("requires the business profile for initial setup", () => {
    expect(
      setupSchema.safeParse({
        businessName: "PETORA",
        branchName: "Klinik Jakarta",
        branchCode: "JKT-01",
        timezone: "Asia/Jakarta",
        locale: "id-ID",
        taxEnabled: false,
        taxRateBps: 0,
        taxIncluded: false,
        name: "Pemilik",
        email: "owner@example.com",
        password: "kata-sandi-aman",
      }).success,
    ).toBe(true);
    expect(
      setupSchema.safeParse({
        businessName: " ",
        branchName: "Klinik",
        branchCode: "X",
        timezone: "Invalid/Zone",
        locale: "id-ID",
        taxEnabled: true,
        taxRateBps: 0,
        taxIncluded: false,
        name: "P",
        email: "bukan-email",
        password: "pendek",
      }).success,
    ).toBe(false);
  });

  it("accepts TOTP and recovery codes only in the two-factor login challenge", () => {
    expect(
      totpLoginChallengeSchema.safeParse({
        challengeToken: "a".repeat(43),
        code: "123456",
      }).success,
    ).toBe(true);
    expect(
      totpLoginChallengeSchema.safeParse({
        challengeToken: "a".repeat(43),
        code: "not a code",
      }).success,
    ).toBe(false);
    expect(totpEnrollmentConfirmationSchema.safeParse({ code: "12345x" }).success).toBe(false);
  });
});
