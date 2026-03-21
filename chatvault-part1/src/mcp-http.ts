import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { summarizeGenericToolArguments } from "./chatvault-browse-tool-log.js";
import {
  createMcpServer,
  getMcpDeploymentHealth,
  MCP_SERVER_INFO,
} from "./create-mcp-server.js";
import { instrumentMcpResponseLogging } from "./mcp-response-logging.js";

type GlobalWithTransports = typeof globalThis & {
  __chatvaultMcpTransports?: Map<string, StreamableHTTPServerTransport>;
};

function getTransportMap(): Map<string, StreamableHTTPServerTransport> {
  const g = globalThis as GlobalWithTransports;
  if (!g.__chatvaultMcpTransports) {
    g.__chatvaultMcpTransports = new Map();
  }
  return g.__chatvaultMcpTransports;
}

export function getMcpSessionId(req: IncomingMessage): string | undefined {
  const h = req.headers["mcp-session-id"];
  if (Array.isArray(h)) {
    return h[0];
  }
  return h;
}

/**
 * Streamable HTTP expects Accept to list both application/json and text/event-stream.
 */
function ensureMcpAcceptHeader(req: IncomingMessage): void {
  const hdr = req.headers.accept;
  const accept = Array.isArray(hdr) ? hdr.join(", ") : (hdr ?? "");
  const hasJson = accept.includes("application/json");
  const hasSse = accept.includes("text/event-stream");
  if (hasJson && hasSse) {
    return;
  }

  const value = "application/json, text/event-stream";
  const raw = req.rawHeaders;
  let replaced = false;
  for (let i = 0; i < raw.length; i += 2) {
    if (String(raw[i]).toLowerCase() === "accept") {
      raw[i + 1] = value;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    raw.push("Accept", value);
  }
  req.headers.accept = value;
}

function formatSessionSuffix(sessionId: string | undefined): string {
  if (sessionId === undefined || sessionId.length === 0) {
    return "";
  }
  const short =
    sessionId.length > 12 ? `${sessionId.slice(0, 8)}…` : sessionId;
  return ` session=${short}`;
}

function logIncomingMcpJsonRpc(body: unknown, sessionId?: string): void {
  if (typeof body !== "object" || body === null || !("method" in body)) {
    return;
  }
  const o = body as { method?: unknown; id?: unknown; params?: unknown };
  const paramKeys =
    o.params != null && typeof o.params === "object" && !Array.isArray(o.params)
      ? Object.keys(o.params as object)
      : [];
  const sid = formatSessionSuffix(sessionId);
  console.log(
    `[mcp] jsonrpc-in${sid} method=${String(o.method)} id=${JSON.stringify(o.id)} paramsKeys=${paramKeys.join(",")}`,
  );
}

/** Explicit `tools/call` line (Prompt 9); detailed browse args logged in tool handler. */
function logToolsCallDispatch(body: unknown, sessionId?: string): void {
  if (typeof body !== "object" || body === null) {
    return;
  }
  const o = body as { method?: unknown; params?: unknown; id?: unknown };
  if (o.method !== "tools/call") {
    return;
  }
  const p = o.params;
  if (p == null || typeof p !== "object" || Array.isArray(p)) {
    return;
  }
  const params = p as Record<string, unknown>;
  const name = typeof params.name === "string" ? params.name : "(missing)";
  const sid = formatSessionSuffix(sessionId);
  const argSummary = summarizeGenericToolArguments(params.arguments);
  console.log(
    `[mcp] tools/call${sid} name=${name} id=${JSON.stringify(o.id)} ${argSummary}`,
  );
}

function sendJsonRpcError(
  res: ServerResponse,
  statusCode: number,
  code: number,
  message: string,
  id: null = null,
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id,
    }),
  );
}

/**
 * POST /mcp — single JSON-RPC object body; Streamable HTTP + JSON responses.
 */
export async function handleNodeMcpPost(
  req: IncomingMessage,
  res: ServerResponse,
  parsedBody: unknown,
): Promise<void> {
  const sessionId = getMcpSessionId(req);
  instrumentMcpResponseLogging(res, { sessionId });
  if (
    parsedBody === null ||
    typeof parsedBody !== "object" ||
    Array.isArray(parsedBody)
  ) {
    sendJsonRpcError(
      res,
      400,
      -32600,
      "Invalid Request: body must be a single JSON object",
    );
    return;
  }

  logIncomingMcpJsonRpc(parsedBody, sessionId);
  logToolsCallDispatch(parsedBody, sessionId);
  ensureMcpAcceptHeader(req);

  const transports = getTransportMap();

  try {
    if (sessionId !== undefined && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, parsedBody);
      return;
    }

    if (sessionId === undefined && isInitializeRequest(parsedBody)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          transports.set(sid, transport);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid !== undefined && transports.get(sid) === transport) {
          transports.delete(sid);
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
      return;
    }

    sendJsonRpcError(
      res,
      400,
      -32000,
      "Bad Request: No valid session ID provided",
    );
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      sendJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }
}

/** GET /mcp — deployment health (server identity + widget bundle on disk). */
export async function handleNodeMcpGet(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  instrumentMcpResponseLogging(res);
  try {
    const health = await getMcpDeploymentHealth();
    const status = health.ok ? 200 : 503;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(health));
  } catch (err) {
    console.error("MCP health check error:", err);
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: false,
        server: { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version },
        widget: { ok: false, bytes: 0 },
        error: "health_check_failed",
      }),
    );
  }
}

/** DELETE /mcp — session termination per MCP streamable HTTP. */
export async function handleNodeMcpDelete(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const sessionId = getMcpSessionId(req);
  instrumentMcpResponseLogging(res, { sessionId });
  const transports = getTransportMap();
  if (sessionId === undefined || !transports.has(sessionId)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid or missing session ID");
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
}
