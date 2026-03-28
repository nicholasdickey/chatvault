import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Verifies connectivity and that pgvector is available (migration applied / extension enabled).
 */
export async function verifyDatabaseOnStartup(): Promise<void> {
  await db.execute(sql`SELECT 1`);
  const result = await db.execute(
    sql`SELECT 1 AS ok FROM pg_extension WHERE extname = 'vector'`,
  );
  const rows = result.rows;
  if (rows.length === 0 || !(rows[0] as { ok?: number })?.ok) {
    throw new Error(
      "pgvector extension is not available; run `pnpm db:migrate` against DATABASE_URL",
    );
  }
}
