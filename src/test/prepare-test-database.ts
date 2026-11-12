import { afterAll } from "vitest";
import { stopNotificationQueue } from "@/server/notifications/queue";

const DEFAULT_TEST_DATABASE_URL = "postgresql://petora:petora_test@localhost:5433/petora_test";
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

if (!new URL(testDatabaseUrl).pathname.endsWith("_test")) {
  throw new Error("Tes integrasi menolak basis data yang namanya tidak berakhiran _test.");
}

process.env.TEST_DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_URL = testDatabaseUrl;

afterAll(stopNotificationQueue);
