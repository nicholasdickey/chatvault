/**
 * Single place for `browseMySavedChats` argument parsing + safe server logs (Prompt 7 / 9).
 */

import type { ChatVaultBrowseContext } from "./chatvault-types.js";

export const BROWSE_MY_SAVED_CHATS_TOOL_NAME = "browseMySavedChats" as const;

const ANON_VISIBLE = 8;
const URL_MAX = 48;

/** Default `tools/call` argument summary: top-level keys only. */
export function summarizeGenericToolArguments(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return "args=absent";
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return "args=(non-object)";
  }
  return `argKeys=${Object.keys(raw).join(",")}`;
}

function truncateUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    const combined = `${u.origin}${u.pathname}${u.search}`;
    if (combined.length <= URL_MAX) {
      return combined;
    }
    return `${combined.slice(0, URL_MAX)}…`;
  } catch {
    return "(invalid-url)";
  }
}

function formatShortAnonId(s: string): string {
  if (s.length <= ANON_VISIBLE) {
    return s;
  }
  return `${s.slice(0, ANON_VISIBLE)}…(len=${s.length})`;
}

/**
 * Normalize tool `arguments` into `ChatVaultBrowseContext` (server + widget shape).
 * Single extraction point for shortAnonId, portalLink, loginLink, isAnon (Prompt 9).
 */
export function parseBrowseMySavedChatsArgs(raw: unknown): ChatVaultBrowseContext {
  if (raw === null || raw === undefined) {
    return {};
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const m: ChatVaultBrowseContext = {};
  if (typeof o.shortAnonId === "string") {
    m.shortAnonId = o.shortAnonId;
  }
  if (typeof o.portalLink === "string") {
    m.portalLink = o.portalLink;
  }
  if (typeof o.loginLink === "string") {
    m.loginLink = o.loginLink;
  }
  if (typeof o.isAnon === "boolean") {
    m.isAnon = o.isAnon;
  }
  return m;
}

/**
 * Redacted one-line summary for server logs (no full URLs or raw tokens).
 */
export function formatBrowseMySavedChatsArgsForLog(ctx: ChatVaultBrowseContext): string {
  const parts: string[] = [];

  if (typeof ctx.shortAnonId === "string" && ctx.shortAnonId.length > 0) {
    parts.push(`shortAnonId=${formatShortAnonId(ctx.shortAnonId)}`);
  } else {
    parts.push("shortAnonId=absent");
  }

  if (typeof ctx.portalLink === "string") {
    parts.push(`portalLink=${truncateUrlForLog(ctx.portalLink)}`);
  } else {
    parts.push("portalLink=absent");
  }

  if (typeof ctx.loginLink === "string") {
    parts.push(`loginLink=${truncateUrlForLog(ctx.loginLink)}`);
  } else {
    parts.push("loginLink=absent");
  }

  if (typeof ctx.isAnon === "boolean") {
    parts.push(`isAnon=${ctx.isAnon}`);
  } else {
    parts.push("isAnon=absent");
  }

  return parts.join(" ");
}

/**
 * Parse browse args and emit the canonical safe dispatch log (Prompt 9).
 */
export function logBrowseMySavedChatsToolDispatch(raw: unknown): ChatVaultBrowseContext {
  const ctx = parseBrowseMySavedChatsArgs(raw);
  console.log(
    `[mcp] tool dispatch name=${BROWSE_MY_SAVED_CHATS_TOOL_NAME} ${formatBrowseMySavedChatsArgsForLog(ctx)}`,
  );
  return ctx;
}
