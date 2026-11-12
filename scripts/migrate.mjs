import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const isTestDatabase = process.argv.includes("--test");
const defaultDatabaseUrl = isTestDatabase
  ? "postgresql://petora:petora_test@localhost:5433/petora_test"
  : "postgresql://petora:petora_dev@localhost:5432/petora";
const databaseUrl =
  (isTestDatabase ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL) ?? defaultDatabaseUrl;

if (isTestDatabase && !new URL(databaseUrl).pathname.endsWith("_test")) {
  throw new Error(
    "Migrasi tes hanya boleh dijalankan pada basis data dengan nama berakhiran _test.",
  );
}

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
  .sort();
const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  const client = await pool.connect();

  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );

    for (const migrationFile of migrationFiles) {
      await client.query("BEGIN");

      try {
        await client.query("SELECT pg_advisory_xact_lock(731094601)");
        const applied = await client.query("SELECT 1 FROM app_migrations WHERE name = $1", [
          migrationFile,
        ]);

        if (applied.rowCount === 0) {
          const migrationSql = await readFile(join(migrationDirectory, migrationFile), "utf8");
          await client.query(migrationSql);
          await client.query("INSERT INTO app_migrations (name) VALUES ($1)", [migrationFile]);
          console.info(`Migrasi diterapkan: ${migrationFile}`);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
