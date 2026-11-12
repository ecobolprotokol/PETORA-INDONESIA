import { describe, expect, it, vi } from "vitest";
import { checkPublicReachability, getPublicAppOrigin } from "./readiness";

describe("public setup readiness", () => {
  it("reports when a public URL has not been configured", async () => {
    await expect(checkPublicReachability(undefined)).resolves.toBe("not_configured");
  });

  it("rejects non-public or non-HTTPS configuration without making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(checkPublicReachability("http://localhost:3000", fetcher)).resolves.toBe(
      "invalid_configuration",
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(getPublicAppOrigin("https://petora.example")).toBe("https://petora.example");
    expect(getPublicAppOrigin("https://user:pass@petora.example")).toBeNull();
  });

  it("verifies the configured public health endpoint", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ service: "petora", status: "ok" }));

    await expect(checkPublicReachability("https://petora.example", fetcher)).resolves.toBe(
      "verified",
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://petora.example/.well-known/petora-health"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("reports a missing or invalid public endpoint response as unreachable", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ service: "other", status: "ok" }));

    await expect(checkPublicReachability("https://petora.example", fetcher)).resolves.toBe(
      "unreachable",
    );
  });
});
