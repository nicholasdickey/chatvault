/**
 * Vercel serverless entry (must live under `api/`). Part 1 uses `api/mcp.ts` the same way.
 * Local dev: `pnpm dev` + `src/index.ts` + `startChatVaultServer`.
 */
import "dotenv/config";
import express from "express";
import { initDatabase } from "../src/db/init.js";
import { createChatVaultMcpApp, resolveChatVaultMcpExpressOptions } from "../src/mcp/httpServer.js";

await initDatabase();
const { app: mcpApp } = createChatVaultMcpApp(resolveChatVaultMcpExpressOptions());

const app = express();
app.use("/api", mcpApp);

export default app;
