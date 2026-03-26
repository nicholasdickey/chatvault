import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export const pool = new pg.Pool({ connectionString: requireDatabaseUrl() });

/** All database access must go through this Drizzle instance. */
export const db = drizzle(pool, { schema });
