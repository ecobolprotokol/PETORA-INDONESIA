import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("public health endpoint", () => {
  it("allows the setup wizard to verify it from a browser", async () => {
    const response = GET();

    await expect(response.json()).resolves.toEqual({ service: "petora", status: "ok" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
