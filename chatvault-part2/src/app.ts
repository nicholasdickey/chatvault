/**
 * Vercel serverless entry: default-export Express app (see Vercel Express docs).
 * Local dev continues to use `src/index.ts` + `startChatVaultServer`.
 */
import "dotenv/config";
import { initDatabase } from "./db/init.js";
import { createChatVaultMcpApp, resolveChatVaultMcpExpressOptions } from "./mcp/httpServer.js";

await initDatabase();
const { app } = createChatVaultMcpApp(resolveChatVaultMcpExpressOptions());
export default app;
