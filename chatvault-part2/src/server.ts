import "dotenv/config";
import type { Server as HttpServer } from "node:http";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { initDatabase } from "./db/init.js";
import { pool } from "./db/client.js";
import {
  closeAllTransports,
  createChatVaultMcpApp,
  resolveChatVaultMcpExpressOptions,
} from "./mcp/httpServer.js";

export type ChatVaultServer = {
  baseUrl: string;
  port: number;
  transports: Record<string, StreamableHTTPServerTransport>;
  close: () => Promise<void>;
};

/**
 * Starts DB migrations + health checks (unless skipped), then the MCP HTTP server.
 * Use `port: 0` for an ephemeral port (tests).
 */
export async function startChatVaultServer(options?: {
  host?: string;
  port?: number;
  skipDatabaseInit?: boolean;
}): Promise<ChatVaultServer> {
  if (!options?.skipDatabaseInit) {
    await initDatabase();
  }

  const host = options?.host ?? process.env.MCP_HOST ?? "127.0.0.1";
  const requestedPort =
    options?.port !== undefined
      ? options.port
      : process.env.MCP_PORT
        ? Number(process.env.MCP_PORT)
        : process.env.PORT
          ? Number(process.env.PORT)
          : 3000;

  const { app, transports } = createChatVaultMcpApp(
    resolveChatVaultMcpExpressOptions({ listenHost: host }),
  );

  const httpServer: HttpServer = await new Promise((resolve, reject) => {
    const s = app.listen(requestedPort, host, () => resolve(s));
    s.on("error", reject);
  });

  const addr = httpServer.address();
  const port = addr && typeof addr === "object" ? addr.port : requestedPort;
  const connectHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const baseUrl = `http://${connectHost}:${port}`;

  console.log(`[chatvault-part2] MCP HTTP listening on ${baseUrl}/mcp`);

  const close = async () => {
    await closeAllTransports(transports);
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
  };

  return { baseUrl, port, transports, close };
}
