import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerLoadChatsTool } from "./tools/loadChats.js";
import { registerSaveChatTool } from "./tools/saveChat.js";
import { registerSearchChatsTool } from "./tools/searchChats.js";

const log = (msg: string, extra?: Record<string, unknown>) => {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[chatvault-part2][mcp] ${msg}`, extra);
  } else {
    console.log(`[chatvault-part2][mcp] ${msg}`);
  }
};

/**
 * Express host options for `createMcpExpressApp` (DNS rebinding / Host header).
 * - Local dev: default localhost protection, or `host: "0.0.0.0"` when binding all interfaces.
 * - Vercel: `allowedHosts` must include the deployment hostname (`VERCEL_URL` is set automatically).
 * - Optional `MCP_ALLOWED_HOSTS`: comma-separated hostnames (e.g. custom domain or preview URLs).
 */
export function resolveChatVaultMcpExpressOptions(options?: {
  listenHost?: string;
}): { host?: string; allowedHosts?: string[] } | undefined {
  const listenHost = options?.listenHost;
  const fromEnv =
    process.env.MCP_ALLOWED_HOSTS?.split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0) ?? [];

  if (process.env.VERCEL) {
    const hosts = new Set<string>(fromEnv);
    const raw = process.env.VERCEL_URL?.trim();
    if (raw) {
      try {
        hosts.add(new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname);
      } catch {
        hosts.add(raw.split("/")[0] ?? raw);
      }
    }
    if (hosts.size === 0) {
      throw new Error(
        "[chatvault-part2] On Vercel, set MCP_ALLOWED_HOSTS or rely on VERCEL_URL (set automatically by Vercel).",
      );
    }
    return { allowedHosts: [...hosts] };
  }

  if (listenHost === "0.0.0.0") {
    if (fromEnv.length > 0) {
      return { host: "0.0.0.0", allowedHosts: fromEnv };
    }
    return { host: "0.0.0.0" };
  }

  if (fromEnv.length > 0) {
    return { allowedHosts: fromEnv };
  }

  return undefined;
}

function createChatVaultMcpServer(): McpServer {
  const server = new McpServer(
    { name: "chatvault-part2", version: "0.0.1" },
    { capabilities: {} },
  );
  registerSaveChatTool(server);
  registerLoadChatsTool(server);
  registerSearchChatsTool(server);
  // Without registered resources, the SDK never installs resources/list handlers.
  const s = server as unknown as { setResourceRequestHandlers(): void };
  s.setResourceRequestHandlers();
  return server;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, mcp-session-id, Authorization, Last-Event-ID, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
} as const;

function sendJsonRpcError(res: Response, status: number, code: number, message: string) {
  log("JSON-RPC error response", { status, code, message });
  res.status(status).json({
    jsonrpc: "2.0",
    error: { code, message },
    id: null,
  });
}

/**
 * Registers Streamable HTTP MCP routes on the given Express app. Active transports are tracked for shutdown.
 */
export function registerMcpRoutes(
  app: Express,
  transports: Record<string, StreamableHTTPServerTransport>,
): void {
  app.options("/mcp", (_req: Request, res: Response) => {
    log("OPTIONS /mcp (CORS preflight)");
    res.set(corsHeaders);
    res.status(204).end();
  });

  app.get("/mcp", (_req: Request, res: Response) => {
    log("GET /mcp rejected (use POST for JSON-RPC)");
    res.status(405).set("Allow", "POST, OPTIONS").send("Method Not Allowed");
  });

  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"];
    log("DELETE /mcp", { sessionId: typeof sessionId === "string" ? sessionId : undefined });
    if (!sessionId || typeof sessionId !== "string" || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    try {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("[chatvault-part2][mcp] DELETE /mcp error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId = typeof sessionHeader === "string" ? sessionHeader : undefined;
    log("POST /mcp", {
      sessionId,
      bodyPreview: typeof req.body === "object" ? JSON.stringify(req.body).slice(0, 500) : undefined,
    });

    try {
      if (sessionId && transports[sessionId]) {
        const transport = transports[sessionId];
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (sid) => {
            log("Session initialized", { sessionId: sid });
            transports[sid] = transport;
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            log("Transport closed; removing session", { sessionId: sid });
            delete transports[sid];
          }
        };
        const mcpServer = createChatVaultMcpServer();
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      sendJsonRpcError(
        res,
        400,
        -32000,
        "Bad Request: No valid session ID provided, or request is not initialize",
      );
    } catch (err) {
      console.error("[chatvault-part2][mcp] POST /mcp error:", err);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, "Internal server error");
      }
    }
  });
}

export function createChatVaultMcpApp(options?: {
  host?: string;
  allowedHosts?: string[];
}): { app: Express; transports: Record<string, StreamableHTTPServerTransport> } {
  const transports: Record<string, StreamableHTTPServerTransport> = {};
  const app = createMcpExpressApp(
    options?.host !== undefined || options?.allowedHosts !== undefined
      ? { host: options.host, allowedHosts: options.allowedHosts }
      : undefined,
  );
  app.use((req, res, next) => {
    if (req.path === "/mcp") {
      for (const [key, value] of Object.entries(corsHeaders)) {
        res.setHeader(key, value);
      }
    }
    next();
  });
  registerMcpRoutes(app, transports);
  return { app, transports };
}

export async function closeAllTransports(
  transports: Record<string, StreamableHTTPServerTransport>,
): Promise<void> {
  const ids = Object.keys(transports);
  for (const id of ids) {
    try {
      log("Closing transport", { sessionId: id });
      await transports[id]?.close();
      delete transports[id];
    } catch (err) {
      console.error(`[chatvault-part2][mcp] Error closing transport ${id}:`, err);
    }
  }
}
