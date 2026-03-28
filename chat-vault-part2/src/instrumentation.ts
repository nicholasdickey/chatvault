export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.warn(
      "chat-vault-part2: DATABASE_URL is not set; skipping database health check",
    );
    return;
  }
  const { verifyDatabaseOnStartup } = await import("@/lib/db-health");
  await verifyDatabaseOnStartup();
  console.info("chat-vault-part2: database connection and pgvector OK");
}
