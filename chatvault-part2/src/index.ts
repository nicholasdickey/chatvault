import "dotenv/config";
import { initDatabase } from "./db/init.js";
import { pool } from "./db/client.js";
import { closeAllTransports, createChatVaultMcpApp } from "./mcp/httpServer.js";

async function main() {
  await initDatabase();

  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const port = Number(process.env.MCP_PORT ?? process.env.PORT ?? 3000);

  const { app, transports } = createChatVaultMcpApp(
    host === "0.0.0.0" ? { host: "0.0.0.0" } : undefined,
  );

  const server = app.listen(port, host, () => {
    console.log(`[chatvault-part2] MCP HTTP listening on http://${host}:${port}/mcp`);
  });

  const shutdown = async () => {
    console.log("[chatvault-part2] Shutting down…");
    await closeAllTransports(transports);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((err: unknown) => {
  console.error("[chatvault-part2] Fatal error:", err);
  process.exit(1);
});
