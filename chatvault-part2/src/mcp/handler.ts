import { Server } from "@modelcontextprotocol/sdk/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  isInitializeRequest,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const LOG_PREFIX = "[mcp]";

export const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, mcp-session-id, Mcp-Session-Id, mcp-protocol-version, Mcp-Protocol-Version, Accept",
  "Access-Control-Max-Age": "86400",
};

type SessionEntry = {
  transport: WebStandardStreamableHTTPServerTransport;
  server: Server;
};

const sessions = new Map<string, SessionEntry>();

export function logMcp(
  operation: string,
  details: Record<string, unknown> = {},
): void {
  console.info(LOG_PREFIX, operation, details);
}

export async function createMcpServer(): Promise<Server> {
  const server = new Server(
    { name: "chatvault-part2", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [] }));
  server.setRequestHandler(ListResourcesRequestSchema, () => ({ resources: [] }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({
    resourceTemplates: [],
  }));

  return server;
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(MCP_CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Prompt4: notifications-only batches use 204; SDK returns 202 for that path. */
export function normalizeMcpResponse(response: Response): Response {
  if (response.status !== 202) {
    return response;
  }
  const headers = new Headers(response.headers);
  return new Response(null, { status: 204, headers });
}

function jsonRpcError(
  status: number,
  code: number,
  message: string,
): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code, message }, id: null },
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function getSessionHeader(request: Request): string | undefined {
  return (
    request.headers.get("mcp-session-id") ??
    request.headers.get("Mcp-Session-Id") ??
    undefined
  );
}

export async function handleMcpGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("health") === "1") {
    logMcp("get_health", {});
    return withCors(
      Response.json(
        {
          ok: true,
          service: "chatvault-part2-mcp",
          usage:
            "POST JSON-RPC initialize to this URL; see MCP Streamable HTTP spec.",
        },
        { headers: { "Content-Type": "application/json" } },
      ),
    );
  }

  const sessionHeader = getSessionHeader(request);
  if (!sessionHeader) {
    logMcp("get_missing_session", {});
    return withCors(
      jsonRpcError(
        400,
        -32000,
        "GET requires mcp-session-id or use ?health=1 for a smoke check.",
      ),
    );
  }

  const entry = sessions.get(sessionHeader);
  if (!entry) {
    logMcp("get_session_not_found", { sessionId: sessionHeader });
    return withCors(jsonRpcError(404, -32001, "Session not found"));
  }

  logMcp("get_transport", { sessionId: sessionHeader });
  const res = await entry.transport.handleRequest(request);
  return withCors(normalizeMcpResponse(res));
}

export async function handleMcpDelete(request: Request): Promise<Response> {
  const sessionHeader = getSessionHeader(request);
  if (!sessionHeader) {
    logMcp("delete_missing_session", {});
    return withCors(
      jsonRpcError(
        400,
        -32000,
        "Bad Request: Mcp-Session-Id header is required",
      ),
    );
  }

  const entry = sessions.get(sessionHeader);
  if (!entry) {
    logMcp("delete_session_not_found", { sessionId: sessionHeader });
    return withCors(jsonRpcError(404, -32001, "Session not found"));
  }

  logMcp("delete_transport", { sessionId: sessionHeader });
  const res = await entry.transport.handleRequest(request);
  return withCors(normalizeMcpResponse(res));
}

export async function handleMcpPost(request: Request): Promise<Response> {
  const ct = request.headers.get("content-type");
  if (!ct || !ct.includes("application/json")) {
    logMcp("post_unsupported_media", { contentType: ct });
    return withCors(jsonRpcError(415, -32000, "Content-Type must be application/json"));
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    logMcp("post_parse_error", {});
    return withCors(jsonRpcError(400, -32700, "Parse error: Invalid JSON"));
  }

  const messages = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
  const isInit = messages.some((m) => isInitializeRequest(m));
  const sessionHeader = getSessionHeader(request);

  if (sessionHeader) {
    const entry = sessions.get(sessionHeader);
    if (!entry) {
      logMcp("post_session_not_found", { sessionId: sessionHeader });
      return withCors(jsonRpcError(404, -32001, "Session not found"));
    }
    logMcp("post_existing_session", {
      sessionId: sessionHeader,
      isInit,
      methods: messages.map((m) =>
        m && typeof m === "object" && "method" in m
          ? (m as { method?: string }).method
          : undefined,
      ),
    });
    const res = await entry.transport.handleRequest(request, { parsedBody });
    return withCors(normalizeMcpResponse(res));
  }

  if (!isInit) {
    logMcp("post_missing_session", {});
    return withCors(
      jsonRpcError(
        400,
        -32000,
        "Bad Request: Mcp-Session-Id header is required for non-initialize requests",
      ),
    );
  }

  logMcp("post_initialize", {
    methods: messages.map((m) =>
      m && typeof m === "object" && "method" in m
        ? (m as { method?: string }).method
        : undefined,
    ),
  });

  const server = await createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (sid) => {
      sessions.set(sid, { transport, server });
      logMcp("session_initialized", { sessionId: sid });
    },
    onsessionclosed: (sid) => {
      sessions.delete(sid);
      logMcp("session_closed_callback", { sessionId: sid });
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      sessions.delete(sid);
      logMcp("transport_closed", { sessionId: sid });
    }
  };

  await server.connect(transport);

  const res = await transport.handleRequest(request, { parsedBody });
  return withCors(normalizeMcpResponse(res));
}

export function handleMcpOptions(): Response {
  logMcp("options_preflight", {});
  return new Response(null, { status: 204, headers: { ...MCP_CORS_HEADERS } });
}
