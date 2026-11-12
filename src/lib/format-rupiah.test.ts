import { describe, expect, it } from "vitest";
import { formatRupiah } from "./format-rupiah";

describe("formatRupiah", () => {
  it("formats integer Rupiah using Indonesian conventions", () => {
    expect(formatRupiah(1_250_000)).toBe("Rp 1.250.000");
  });

  it("rejects fractional and unsafe amounts", () => {
    expect(() => formatRupiah(12.5)).toThrow(RangeError);
    expect(() => formatRupiah(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
