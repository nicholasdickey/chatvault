/**
 * Runs before `drizzle-kit migrate` so connection failures print a clear pg error
 * (drizzle’s spinner often hides the underlying message).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(packageRoot, ".env") });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(`[db:migrate] DATABASE_URL is missing. Add it to ${path.join(packageRoot, ".env")}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query("select 1");
  console.log("[db:migrate] connection OK");
} catch (err) {
  const e = err;
  console.error("[db:migrate] connection failed:", e?.message ?? e);
  if (e?.code) console.error("  code:", e.code);
  process.exit(1);
} finally {
  await client.end();
}
