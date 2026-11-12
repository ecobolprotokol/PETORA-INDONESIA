import { describe, expect, it } from "vitest";
import { customerSchema } from "./validation";

describe("customer input validation", () => {
  it("accepts Indonesian phone formats and normalizes an empty email to null", () => {
    expect(
      customerSchema.parse({
        name: "Pelanggan Uji",
        phone: "+62 812-3456-7890",
        email: "",
      }),
    ).toEqual({
      name: "Pelanggan Uji",
      phone: "+62 812-3456-7890",
      email: null,
    });
  });

  it("rejects phone numbers without an Indonesian prefix and malformed email", () => {
    expect(
      customerSchema.safeParse({
        name: "Pelanggan Uji",
        phone: "+1 212-555-0101",
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });
});
