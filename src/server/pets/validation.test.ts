import { describe, expect, it } from "vitest";
import { petSchema, petWeightSchema } from "./validation";

describe("pet validation", () => {
  const ownerId = "d89b2ca1-bd1f-4457-8b64-8a512473f6c1";

  it("requires unique owners and exactly one primary owner", () => {
    const base = {
      name: "Milo",
      species: "cat",
      owners: [{ customerId: ownerId, isPrimary: true }],
    };
    expect(petSchema.safeParse(base).success).toBe(true);
    expect(
      petSchema.safeParse({
        ...base,
        owners: [
          { customerId: ownerId, isPrimary: true },
          { customerId: ownerId, isPrimary: false },
        ],
      }).success,
    ).toBe(false);
    expect(
      petSchema.safeParse({
        ...base,
        owners: [{ customerId: ownerId, isPrimary: false }],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid birth dates and unreasonable weights", () => {
    const invalidPet = petSchema.safeParse({
      name: "Milo",
      species: "cat",
      birthDate: "2026-02-31",
      owners: [{ customerId: ownerId, isPrimary: true }],
    });
    expect(invalidPet.success).toBe(false);
    expect(petWeightSchema.safeParse({ weightKg: 0 }).success).toBe(false);
  });
});
