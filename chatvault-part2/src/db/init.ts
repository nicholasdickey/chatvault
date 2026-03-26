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

function shouldRunMigrations(): boolean {
  if (process.env.RUN_MIGRATIONS_ON_VERCEL === "1") {
    return true;
  }
  // Serverless: many cold starts can run migrate() in parallel → duplicate CREATE TABLE (42P07).
  // Apply schema once with `pnpm db:migrate` against DATABASE_URL (Neon), not on every request.
  if (process.env.VERCEL) {
    return false;
  }
  if (process.env.SKIP_DATABASE_MIGRATE === "1") {
    return false;
  }
  return true;
}

/**
 * Runs migrations (unless skipped) and verifies connectivity + pgvector. Does not close the pool.
 */
export async function initDatabase(): Promise<void> {
  if (shouldRunMigrations()) {
    log("Running database migrations…");
    await migrate(db, { migrationsFolder });
  } else {
    log(
      process.env.VERCEL
        ? "Skipping migrations on Vercel (run `pnpm db:migrate` with your Neon DATABASE_URL locally or in CI)."
        : "Skipping migrations (SKIP_DATABASE_MIGRATE=1).",
    );
  }

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
