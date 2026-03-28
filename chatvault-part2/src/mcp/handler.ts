import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ErrorCode, isInitializeRequest, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { count, desc, eq } from "drizzle-orm";

import { chats } from "@/db/schema";
import { getDb } from "@/db";
import { buildEmbeddingInput } from "@/lib/chat-text";
import { embedText } from "@/lib/embeddings";
import {
  clampLoadMyChatsLimit,
  nextCursorAfterPage,
  resolveLoadMyChatsPage,
  totalPagesFromTotal,
} from "@/lib/load-my-chats-cursor";

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
  mcp: McpServer;
};

const sessions = new Map<string, SessionEntry>();

export function logMcp(
  operation: string,
  details: Record<string, unknown> = {},
): void {
  console.info(LOG_PREFIX, operation, details);
}

export async function createMcpServer(): Promise<McpServer> {
  const mcp = new McpServer(
    { name: "chatvault-part2", version: "0.1.0" },
    { capabilities: { tools: { listChanged: true } } },
  );

  mcp.registerTool(
    "saveChat",
    {
      description:
        "Persist a chat for a user: stores title, turns, and a vector embedding of the full conversation (all prompts and responses).",
      inputSchema: {
        userId: z
          .string()
          .min(1, "userId is required")
          .describe("Required user identifier"),
        title: z.string().describe("Chat title"),
        turns: z
          .array(
            z.object({
              prompt: z.string(),
              response: z.string(),
            }),
          )
          .describe("Prompt/response turns (same shape as Part 1 ChatTurn)"),
      },
    },
    async (args) => {
      const started = Date.now();
      logMcp("saveChat_start", {
        userId: args.userId,
        turns: args.turns.length,
        titleLen: args.title.length,
      });
      try {
        const text = buildEmbeddingInput(args.title, args.turns);
        const embedding = await embedText(text);
        const [row] = await getDb()
          .insert(chats)
          .values({
            userId: args.userId,
            title: args.title,
            turns: args.turns,
            embedding,
          })
          .returning({ id: chats.id });
        if (!row) {
          throw new McpError(ErrorCode.InternalError, "Failed to insert chat");
        }
        logMcp("saveChat_ok", {
          userId: args.userId,
          chatId: row.id,
          ms: Date.now() - started,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ chatId: row.id }),
            },
          ],
        };
      } catch (err) {
        if (err instanceof McpError) {
          logMcp("saveChat_mcp_error", {
            message: err.message,
            code: err.code,
          });
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        logMcp("saveChat_error", { userId: args.userId, message });
        throw new McpError(ErrorCode.InternalError, message);
      }
    },
  );

  mcp.registerTool(
    "loadMyChats",
    {
      description:
        "Paged list of saved chats for a user (newest first). Optional `cursor` (Part 1) selects the page and overrides `page`.",
      inputSchema: {
        userId: z
          .string()
          .min(1, "userId is required")
          .describe("Required user identifier"),
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).optional().default(10),
        cursor: z
          .string()
          .optional()
          .describe(
            "Opaque page cursor from a prior response (`nextCursor`); when set, overrides `page`.",
          ),
      },
    },
    async (args) => {
      const started = Date.now();
      const limit = clampLoadMyChatsLimit(args.limit ?? 10);
      const rawPage = args.page ?? 1;
      const page = resolveLoadMyChatsPage(args.cursor, rawPage);
      if (page < 1) {
        logMcp("loadMyChats_invalid_cursor", { userId: args.userId });
        throw new McpError(ErrorCode.InvalidParams, "Invalid cursor");
      }

      logMcp("loadMyChats_start", {
        userId: args.userId,
        page,
        limit,
        hasCursor: Boolean(args.cursor?.length),
      });

      try {
        const db = getDb();
        const [countRow] = await db
          .select({ count: count() })
          .from(chats)
          .where(eq(chats.userId, args.userId));

        const total = Number(countRow?.count ?? 0);
        const totalPages = totalPagesFromTotal(total, limit);

        const rows = await db
          .select({
            title: chats.title,
            timestamp: chats.timestamp,
            turns: chats.turns,
          })
          .from(chats)
          .where(eq(chats.userId, args.userId))
          .orderBy(desc(chats.timestamp))
          .limit(limit)
          .offset((page - 1) * limit);

        const chatsOut = rows.map((r) => {
          const ts = r.timestamp;
          return {
            title: r.title,
            timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
            turns: r.turns,
          };
        });

        const nextCursor = nextCursorAfterPage(page, totalPages);

        const structuredContent = {
          chats: chatsOut,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
          nextCursor,
        };

        logMcp("loadMyChats_ok", {
          userId: args.userId,
          returned: chatsOut.length,
          total,
          ms: Date.now() - started,
        });

        return {
          content: [
            {
              type: "text",
              text:
                total === 0
                  ? "No saved chats found."
                  : `Loaded ${chatsOut.length} chat(s) (page ${page} of ${totalPages || 1}, ${total} total).`,
            },
          ],
          structuredContent,
        };
      } catch (err) {
        if (err instanceof McpError) {
          logMcp("loadMyChats_mcp_error", {
            message: err.message,
            code: err.code,
          });
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        logMcp("loadMyChats_error", { userId: args.userId, message });
        throw new McpError(ErrorCode.InternalError, message);
      }
    },
  );

  return mcp;
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

  const mcp = await createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (sid) => {
      sessions.set(sid, { transport, mcp });
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

  await mcp.connect(transport);

  const res = await transport.handleRequest(request, { parsedBody });
  return withCors(normalizeMcpResponse(res));
}

export function handleMcpOptions(): Response {
  logMcp("options_preflight", {});
  return new Response(null, { status: 204, headers: { ...MCP_CORS_HEADERS } });
}
