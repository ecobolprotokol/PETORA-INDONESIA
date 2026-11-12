import { describe, expect, it } from "vitest";
import { renderNotificationTemplate } from "./template";

describe("renderNotificationTemplate", () => {
  it("renders named variables without interpreting their contents", () => {
    expect(
      renderNotificationTemplate("Halo {{ name }}: {{detail}}", {
        name: "<Nama>",
        detail: "{{not-a-placeholder}}",
      }),
    ).toBe("Halo <Nama>: {{not-a-placeholder}}");
  });

  it("rejects missing placeholders", () => {
    expect(() => renderNotificationTemplate("Halo {{name}}", {})).toThrow(
      'Variabel template notifikasi "name" tidak tersedia.',
    );
  });

  it("rejects malformed placeholders", () => {
    expect(() => renderNotificationTemplate("Halo {{ name-name }}", {})).toThrow(
      "Template notifikasi memuat placeholder yang tidak valid.",
    );
  });
});
