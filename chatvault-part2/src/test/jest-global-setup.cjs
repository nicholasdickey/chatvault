/**
 * Jest globalSetup: run Drizzle migrations against the Docker test DB only.
 * Never uses DATABASE_URL (Neon) — only TEST_DATABASE_URL or the default local URL.
 */
const { execSync } = require("node:child_process");
const path = require("node:path");

/** Same default as `pnpm test` when DATABASE_URL is unset (package.json). */
const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5433/chatvault_test";

module.exports = async function jestGlobalSetup() {
  const root = path.join(__dirname, "..", "..");
  require("dotenv").config({ path: path.join(root, ".env") });

  const migrateUrl =
    process.env.TEST_DATABASE_URL?.trim() || DEFAULT_TEST_DATABASE_URL;

  console.log("[jest-global-setup] pnpm db:migrate → Docker test DB only");
  execSync("pnpm db:migrate", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: migrateUrl },
  });
};
