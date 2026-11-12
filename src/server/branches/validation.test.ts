import { describe, expect, it } from "vitest";
import { branchSchema } from "./validation";

describe("branch validation", () => {
  it("normalizes branch codes and accepts valid IANA time zones", () => {
    expect(
      branchSchema.parse({
        code: " jkt-01 ",
        name: "Klinik Jakarta",
        timezone: "Asia/Jakarta",
      }),
    ).toEqual({
      code: "JKT-01",
      name: "Klinik Jakarta",
      timezone: "Asia/Jakarta",
    });
  });

  it("rejects malformed codes and unknown time zones", () => {
    expect(
      branchSchema.safeParse({
        code: "J",
        name: "Klinik Jakarta",
        timezone: "Mars/Olympus",
      }).success,
    ).toBe(false);
  });
});
