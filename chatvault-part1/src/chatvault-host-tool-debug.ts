import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function summarizeContentBlock(
  block: { type?: string; text?: string } | Record<string, unknown>,
): Record<string, unknown> {
  const type = typeof block.type === "string" ? block.type : "?";
  if (type === "text" && typeof block.text === "string") {
    const text = block.text;
    const max = 240;
    return {
      type,
      textPreview:
        text.length <= max ? text : `${text.slice(0, max)}… (${text.length} chars)`,
    };
  }
  return { type, note: "non-text or empty" };
}

function summarizeStructuredContent(sc: unknown): unknown {
  if (sc === null || sc === undefined) {
    return sc;
  }
  if (typeof sc !== "object" || Array.isArray(sc)) {
    return { kind: "other" };
  }
  const o = sc as Record<string, unknown>;
  if (Array.isArray(o.chats) && "nextCursor" in o) {
    return {
      kind: "loadMyChats",
      chatsCount: o.chats.length,
      nextCursor: o.nextCursor,
    };
  }
  return { kind: "object", keys: Object.keys(o) };
}

/**
 * Bounded, debug-safe view of the host's last `CallToolResult` (maps to client `result` / `_meta`).
 * Avoids dumping full chat payloads into the debug UI.
 */
export function summarizeHostToolResultForDebug(
  result: CallToolResult,
): Record<string, unknown> {
  const content = Array.isArray(result.content)
    ? result.content.map((c) =>
        summarizeContentBlock(c as Record<string, unknown>),
      )
    : result.content;
  return {
    isError: result.isError === true,
    content,
    structuredContent: summarizeStructuredContent(result.structuredContent),
    _meta: result._meta,
  };
}
