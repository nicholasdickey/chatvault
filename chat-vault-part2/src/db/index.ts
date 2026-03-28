import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { pool: Pool | undefined };

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

let dbInstance: NodePgDatabase<Record<string, never>> | undefined;

/**
 * Returns the shared Drizzle instance. All DB access must go through this.
 * Throws if DATABASE_URL is missing when first invoked.
 */
export function getDb(): NodePgDatabase<Record<string, never>> {
  if (!dbInstance) {
    dbInstance = drizzle({ client: getPool() });
  }
  return dbInstance;
}
