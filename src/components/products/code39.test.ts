import { describe, expect, it } from "vitest";
import { code39Modules } from "./code39";

describe("Code 39 barcode labels", () => {
  it("encodes full ASCII text with start/stop bars", () => {
    const modules = code39Modules("SKU-123");

    expect(modules).not.toBeNull();
    if (!modules) return;
    expect(modules[0]).toBe(true);
    expect(modules.at(-1)).toBe(true);
    expect(modules).toContain(false);
  });

  it("uses Full ASCII pairs and declines unsupported Unicode", () => {
    expect(code39Modules("A")).toHaveLength(47);
    expect(code39Modules("a")).toHaveLength(63);
    expect(code39Modules("PETÖRA")).toBeNull();
    expect(code39Modules("A".repeat(80))).toBeNull();
  });
});
