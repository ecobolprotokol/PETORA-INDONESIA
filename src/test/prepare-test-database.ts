const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL wajib diatur untuk tes integrasi.");
}

if (!new URL(testDatabaseUrl).pathname.endsWith("_test")) {
  throw new Error("Tes integrasi menolak basis data yang namanya tidak berakhiran _test.");
}

process.env.DATABASE_URL = testDatabaseUrl;
