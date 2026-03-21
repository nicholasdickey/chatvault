import type { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { parseBrowseMySavedChatsArgs } from "./chatvault-browse-tool-log.js";
import { loadMyChatsFixture } from "./chatvault-fixtures.js";
import type {
  ChatVaultBrowseContext,
  LoadMyChatsStructuredContent,
} from "./chatvault-types.js";

/** Parse `browseMySavedChats` tool arguments from the host (`ui/notifications/tool-input`). */
export function parseBrowseContextFromArguments(
  args: unknown,
): ChatVaultBrowseContext {
  return parseBrowseMySavedChatsArgs(args);
}

/** Read `_meta.chatVault` from a `CallToolResult` (e.g. after `browseMySavedChats`). */
export function parseChatVaultFromToolResult(
  result: CallToolResult,
): ChatVaultBrowseContext {
  const meta = result._meta as Record<string, unknown> | undefined;
  const cv = meta?.chatVault;
  if (cv === null || typeof cv !== "object" || Array.isArray(cv)) {
    return {};
  }
  return parseBrowseContextFromArguments(cv);
}

function isLoadMyChatsPayload(
  v: unknown,
): v is LoadMyChatsStructuredContent {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    return false;
  }
  const o = v as Record<string, unknown>;
  return Array.isArray(o.chats) && "nextCursor" in o;
}

export function parseLoadMyChatsStructured(
  result: CallToolResult,
): LoadMyChatsStructuredContent | null {
  const sc = result.structuredContent;
  if (!isLoadMyChatsPayload(sc)) {
    return null;
  }
  return sc;
}

export function hostSupportsServerTools(app: App): boolean {
  const st = app.getHostCapabilities()?.serverTools;
  return st !== undefined && st !== null;
}

export type LoadChatsForWidgetResult = {
  source: "mcp" | "mock";
  data: LoadMyChatsStructuredContent;
  /** Why fixture path was used (Prompt 8 debug). */
  mockReason?: string;
};

/**
 * Load chats via MCP (`loadMyChats`) when the host proxies server tools; otherwise fixture data.
 */
export async function loadChatsForWidget(
  app: App | null,
  isConnected: boolean,
  userId: string,
  cursor?: string | null,
): Promise<LoadChatsForWidgetResult> {
  if (!app) {
    return {
      source: "mock",
      data: loadMyChatsFixture(userId, cursor),
      mockReason: "no_app",
    };
  }
  if (!isConnected) {
    return {
      source: "mock",
      data: loadMyChatsFixture(userId, cursor),
      mockReason: "not_connected",
    };
  }
  if (!hostSupportsServerTools(app)) {
    return {
      source: "mock",
      data: loadMyChatsFixture(userId, cursor),
      mockReason: "no_server_tools",
    };
  }

  try {
    const result = await app.callServerTool({
      name: "loadMyChats",
      arguments: {
        userId,
        ...(cursor ? { cursor } : {}),
      },
    });
    if (result.isError) {
      return {
        source: "mock",
        data: loadMyChatsFixture(userId, cursor),
        mockReason: "tool_error",
      };
    }
    const parsed = parseLoadMyChatsStructured(result);
    if (parsed) {
      return { source: "mcp", data: parsed };
    }
    return {
      source: "mock",
      data: loadMyChatsFixture(userId, cursor),
      mockReason: "bad_shape",
    };
  } catch {
    return {
      source: "mock",
      data: loadMyChatsFixture(userId, cursor),
      mockReason: "exception",
    };
  }
}

export function summarizeBrowseContext(ctx: ChatVaultBrowseContext): string {
  const parts: string[] = [];
  if (ctx.shortAnonId) {
    parts.push(`anon=${ctx.shortAnonId.slice(0, 12)}…`);
  }
  if (ctx.portalLink) {
    parts.push("portal=yes");
  }
  if (ctx.loginLink) {
    parts.push("login=yes");
  }
  if (ctx.isAnon === true) {
    parts.push("isAnon");
  }
  return parts.length > 0 ? parts.join(", ") : "(no browse fields)";
}

/**
 * Normalized bootstrap meta for debug UI (what the host surfaces as `result.meta` / `_meta.chatVault`).
 */
export function getWidgetBootstrapMeta(
  merged: ChatVaultBrowseContext,
): ChatVaultBrowseContext {
  const m: ChatVaultBrowseContext = {};
  if (typeof merged.shortAnonId === "string") {
    m.shortAnonId = merged.shortAnonId;
  }
  if (typeof merged.portalLink === "string") {
    m.portalLink = merged.portalLink;
  }
  if (typeof merged.loginLink === "string") {
    m.loginLink = merged.loginLink;
  }
  if (typeof merged.isAnon === "boolean") {
    m.isAnon = merged.isAnon;
  }
  return m;
}
