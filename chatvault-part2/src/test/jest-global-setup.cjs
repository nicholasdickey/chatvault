/**
 * Jest globalSetup (test harness only): apply Drizzle migrations before any suite runs.
 * Production code never calls migrate — use `pnpm db:migrate` for dev/deploy.
 */
const { execSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function jestGlobalSetup() {
  const root = path.join(__dirname, "..", "..");
  require("dotenv").config({ path: path.join(root, ".env") });

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "[jest-global-setup] DATABASE_URL is required (e.g. from .env or `pnpm test` default).",
    );
  }

  console.log("[jest-global-setup] pnpm db:migrate (DATABASE_URL set)");
  execSync("pnpm db:migrate", {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
};
