import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/** Used by `pnpm db:migrate` (dev Neon) and by Jest globalSetup (test DB — see TEST_DATABASE_URL). */
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error(
    "DATABASE_URL is missing. Set it in chatvault-part2/.env (Neon for dev migrations, or let Jest pass the test DB URL).",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
