import { isIP } from "node:net";

export type PublicReachabilityStatus =
  | "verified"
  | "not_configured"
  | "invalid_configuration"
  | "unreachable";

const HEALTH_PATH = "/.well-known/petora-health";

function parsePublicAppUrl(publicAppUrl: string | undefined): URL | null {
  if (!publicAppUrl) {
    return null;
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(publicAppUrl);
  } catch {
    return null;
  }

  if (
    baseUrl.protocol !== "https:" ||
    !baseUrl.hostname ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    baseUrl.pathname !== "/" ||
    baseUrl.hostname === "localhost" ||
    isIP(baseUrl.hostname)
  ) {
    return null;
  }

  return baseUrl;
}

export function getPublicAppOrigin(publicAppUrl: string | undefined): string | null {
  return parsePublicAppUrl(publicAppUrl)?.origin ?? null;
}

export async function checkPublicReachability(
  publicAppUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<PublicReachabilityStatus> {
  if (!publicAppUrl) {
    return "not_configured";
  }

  const baseUrl = parsePublicAppUrl(publicAppUrl);
  if (!baseUrl) {
    return "invalid_configuration";
  }

  try {
    const response = await fetcher(new URL(HEALTH_PATH, baseUrl), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return "unreachable";
    }

    const body: unknown = await response.json().catch(() => null);
    if (
      typeof body !== "object" ||
      body === null ||
      !("service" in body) ||
      body.service !== "petora" ||
      !("status" in body) ||
      body.status !== "ok"
    ) {
      return "unreachable";
    }

    return "verified";
  } catch {
    return "unreachable";
  }
}
