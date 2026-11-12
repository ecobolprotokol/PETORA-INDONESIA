import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;

const DEFAULT_DATABASE_URL = "postgresql://petora:petora_dev@localhost:5432/petora";

const globalForDatabase = globalThis as typeof globalThis & {
  petoraPool?: Pool;
  petoraDatabase?: Database;
};

export function getDatabase(): Database {
  const connectionString = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

  if (!globalForDatabase.petoraDatabase) {
    const pool = new Pool({ connectionString, max: 10 });
    globalForDatabase.petoraPool = pool;
    globalForDatabase.petoraDatabase = drizzle(pool, { schema });
  }

  return globalForDatabase.petoraDatabase;
}

export async function closeDatabase(): Promise<void> {
  if (globalForDatabase.petoraPool) {
    await globalForDatabase.petoraPool.end();
    delete globalForDatabase.petoraPool;
    delete globalForDatabase.petoraDatabase;
  }
}
