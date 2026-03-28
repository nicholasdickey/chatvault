import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool: Pool | undefined };

export type AppDatabase = NodePgDatabase<typeof schema>;

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForDb.pool) {
    globalForDb.pool = new Pool({
      connectionString: url,
      max: 10,
    });
  }
  return globalForDb.pool;
}

let dbInstance: AppDatabase | undefined;

/**
 * Returns the shared Drizzle instance. All DB access must go through `db` / `getDb()`.
 * Throws if DATABASE_URL is missing when first invoked.
 */
export function getDb(): AppDatabase {
  if (!dbInstance) {
    dbInstance = drizzle({ client: getPool(), schema });
  }
  return dbInstance;
}


/**
 * Close the shared pg pool (e2e tests only; avoids Jest open handles).
 */
export async function closeDbPool(): Promise<void> {
  dbInstance = undefined;
  if (globalForDb.pool) {
    await globalForDb.pool.end();
    globalForDb.pool = undefined;
  }
}
/** Shared Drizzle `db` instance (Prompt3 non-negotiable: all DB access through this). */
export const db: AppDatabase = new Proxy({} as AppDatabase, {
  get(_target, prop, receiver) {
    const instance = getDb();
    return Reflect.get(instance as object, prop, receiver);
  },
});
