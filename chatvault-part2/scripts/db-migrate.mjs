/**
 * Dev/CI migration runner: same work as `drizzle-kit migrate`, but prints full errors
 * (Postgres code, message, stack) instead of failing inside a silent spinner.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(packageRoot, ".env") });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    `[db:migrate] DATABASE_URL is missing. Set it in ${path.join(packageRoot, ".env")}`,
  );
  process.exit(1);
}

const migrationsFolder = path.join(packageRoot, "drizzle");
const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);

try {
  console.log("[db:migrate] applying migrations from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("[db:migrate] done");
} catch (err) {
  console.error("[db:migrate] failed:");
  console.error(err);
  if (err && typeof err === "object" && "code" in err) {
    console.error("  Postgres code:", err.code);
  }
  process.exit(1);
} finally {
  await pool.end();
}
