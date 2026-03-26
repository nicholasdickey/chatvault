import { sql } from "drizzle-orm";
import { db } from "./client.js";

const log = (msg: string) => console.log(`[chatvault-part2] ${msg}`);

/**
 * Runtime DB checks only. Schema changes are applied with `pnpm db:generate` / `pnpm db:migrate`, never here.
 */
export async function initDatabase(): Promise<void> {
  log("Testing database connection…");
  await db.execute(sql`SELECT 1`);

  log("Verifying pgvector extension…");
  const result = await db.execute(sql`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
  `);
  const row = result.rows[0] as { extname?: string; extversion?: string } | undefined;
  if (!row?.extname) {
    throw new Error(
      "pgvector extension is missing. Run `pnpm db:migrate` so migrations (including enable_pgvector) are applied.",
    );
  }
  log(`pgvector OK (version ${row.extversion ?? "unknown"})`);
  log("Database ready.");
}
