import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

/**
 * Truncates all user tables in `public`, excluding Drizzle migration metadata.
 */
export async function truncateAllUserTables(): Promise<void> {
  const result = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('__drizzle_migrations')
  `);
  for (const row of result.rows) {
    const name = (row as { tablename: string }).tablename;
    if (!/^[\w]+$/.test(name)) {
      continue;
    }
    await db.execute(
      sql.raw(`TRUNCATE TABLE public."${name.replace(/"/g, '""')}" CASCADE`),
    );
  }
}
