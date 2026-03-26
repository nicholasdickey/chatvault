import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client.js";

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle",
);

const log = (msg: string) => console.log(`[chatvault-part2] ${msg}`);

/**
 * Runs migrations and verifies connectivity + pgvector. Does not close the pool.
 */
export async function initDatabase(): Promise<void> {
  log("Running database migrations…");
  await migrate(db, { migrationsFolder });

  log("Testing database connection…");
  await db.execute(sql`SELECT 1`);

  log("Verifying pgvector extension…");
  const result = await db.execute(sql`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
  `);
  const row = result.rows[0] as { extname?: string; extversion?: string } | undefined;
  if (!row?.extname) {
    throw new Error(
      "pgvector extension is missing. Ensure migration 0000_enable_pgvector ran successfully.",
    );
  }
  log(`pgvector OK (version ${row.extversion ?? "unknown"})`);
  log("Database ready.");
}
