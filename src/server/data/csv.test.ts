import { describe, expect, it } from "vitest";
import { encodeCsv, parseCsv } from "./csv";

describe("CSV utilities", () => {
  it("round-trips commas, quotes, and embedded newlines", () => {
    const rows = [
      ["name", "address"],
      ["Milo", 'Jalan 1, "Blok A"\nKota'],
    ];
    expect(parseCsv(encodeCsv(rows), { maxRows: 10, maxColumns: 4, maxCellLength: 100 })).toEqual(
      rows,
    );
  });

  it("rejects malformed quoting and values exceeding limits", () => {
    expect(() =>
      parseCsv('name\n"unclosed', { maxRows: 10, maxColumns: 4, maxCellLength: 100 }),
    ).toThrow();
    expect(() =>
      parseCsv("name\nlong", { maxRows: 10, maxColumns: 4, maxCellLength: 3 }),
    ).toThrow();
  });
});
