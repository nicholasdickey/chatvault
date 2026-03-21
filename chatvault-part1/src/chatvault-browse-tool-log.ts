/**
 * Safe logging for `browseMySavedChats`: prefer top-level argument keys only (Prompt 7).
 */

export const BROWSE_MY_SAVED_CHATS_TOOL_NAME = "browseMySavedChats" as const;

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
