import "dotenv/config";
import { startChatVaultServer } from "./server.js";

async function main() {
  const { close } = await startChatVaultServer();

  const shutdown = async () => {
    console.log("[chatvault-part2] Shutting down…");
    await close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((err: unknown) => {
  console.error("[chatvault-part2] Fatal error:", err);
  process.exit(1);
});
