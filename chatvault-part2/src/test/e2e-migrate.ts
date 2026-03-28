import { execSync } from "node:child_process";

/**
 * Applies Drizzle migrations against `databaseUrl` (Prompt5: run before e2e).
 */
export function runMigrations(projectRoot: string, databaseUrl: string): void {
  execSync("pnpm exec drizzle-kit migrate", {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
