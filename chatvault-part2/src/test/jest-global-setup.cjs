/**
 * Jest globalSetup (test harness only): apply Drizzle migrations before any suite runs.
 * Uses TEST_DATABASE_URL when set so Neon dev DATABASE_URL in .env is not migrated by tests.
 */
const { execSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function jestGlobalSetup() {
  const root = path.join(__dirname, "..", "..");
  require("dotenv").config({ path: path.join(root, ".env") });

  const testDb = process.env.TEST_DATABASE_URL?.trim();
  const fallback = process.env.DATABASE_URL?.trim();
  const migrateUrl = testDb || fallback;

  if (!migrateUrl) {
    throw new Error(
      "[jest-global-setup] Set TEST_DATABASE_URL (Docker) in .env and/or run via `pnpm test` so DATABASE_URL is set.",
    );
  }

  if (!testDb) {
    try {
      if (/\.neon\.tech$/i.test(new URL(migrateUrl).hostname)) {
        throw new Error(
          "[jest-global-setup] Refusing to migrate Neon from Jest. Add TEST_DATABASE_URL (local Docker) to .env; use `pnpm db:migrate` for Neon dev.",
        );
      }
    } catch (e) {
      if (e instanceof TypeError) {
        /* invalid URL — skip Neon guard */
      } else {
        throw e;
      }
    }
  }

  console.log("[jest-global-setup] pnpm db:migrate (test DB only)");
  execSync("pnpm db:migrate", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: migrateUrl },
  });
};
