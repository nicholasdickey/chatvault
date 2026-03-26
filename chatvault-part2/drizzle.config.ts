import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

/** Package root (same folder as this file), so .env and paths work regardless of shell cwd. */
const packageRoot = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(packageRoot, ".env") });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error(
    `DATABASE_URL is missing. Set it in ${path.join(packageRoot, ".env")} (e.g. Neon URI for dev migrations).`,
  );
}

export default defineConfig({
  schema: path.join(packageRoot, "src/db/schema.ts"),
  out: path.join(packageRoot, "drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
