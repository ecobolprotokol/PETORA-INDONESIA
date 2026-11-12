import { describe, expect, it } from "vitest";
import { centsForQuantity, formatQuantity, parseQuantity, weightedAverageCost } from "./quantity";

describe("inventory quantity math", () => {
  it("parses exact thousandths and rejects excess precision", () => {
    expect(parseQuantity("12.045")).toBe(12_045n);
    expect(formatQuantity(12_045n)).toBe("12.045");
    expect(formatQuantity(-1_500n)).toBe("-1.5");
    expect(() => parseQuantity("1.0001")).toThrow();
  });

  it("calculates safe inventory values and weighted average unit cost", () => {
    expect(centsForQuantity(1_500n, 101)).toBe(152);
    expect(weightedAverageCost([1_000n, 3_000n], [100, 200])).toBe(175);
    expect(weightedAverageCost([0n], [250])).toBe(0);
  });
});
