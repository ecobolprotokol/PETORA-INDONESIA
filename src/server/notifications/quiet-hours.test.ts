import { describe, expect, it } from "vitest";
import { quietHoursStartAfter } from "./quiet-hours";

describe("quietHoursStartAfter", () => {
  it("does not defer a notification outside quiet hours", () => {
    expect(
      quietHoursStartAfter(new Date("2026-01-15T03:00:00.000Z"), {
        enabled: true,
        start: "22:00",
        end: "08:00",
        timeZone: "Asia/Jakarta",
      }),
    ).toBeUndefined();
  });

  it("defers overnight quiet hours to the local end time", () => {
    expect(
      quietHoursStartAfter(new Date("2026-01-15T18:00:00.000Z"), {
        enabled: true,
        start: "22:00",
        end: "08:00",
        timeZone: "Asia/Jakarta",
      }),
    ).toEqual(new Date("2026-01-16T01:00:00.000Z"));
  });

  it("defers a notification that arrives after midnight", () => {
    expect(
      quietHoursStartAfter(new Date("2026-01-15T23:00:00.000Z"), {
        enabled: true,
        start: "22:00",
        end: "08:00",
        timeZone: "Asia/Jakarta",
      }),
    ).toEqual(new Date("2026-01-16T01:00:00.000Z"));
  });
});
