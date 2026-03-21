/**
 * Best-effort client label for debug (Prompt 8). Does not identify users.
 */
export function getWidgetClientTypeLabel(
  standalone: boolean,
  isConnected: boolean,
): string {
  if (typeof window === "undefined") {
    return "ssr";
  }
  const w = window as Window & { openai?: unknown; appbridge?: unknown };
  if (typeof w.openai !== "undefined") {
    return "openai_present";
  }
  if (typeof w.appbridge !== "undefined") {
    return "appbridge_present";
  }
  if (standalone) {
    return "standalone_preview";
  }
  if (window.self !== window.top) {
    return isConnected ? "mcp_iframe_connected" : "mcp_iframe_disconnected";
  }
  return "unknown_top_window";
}

export function getWindowBridgeFlags(): { openai: boolean; appbridge: boolean } {
  if (typeof window === "undefined") {
    return { openai: false, appbridge: false };
  }
  const w = window as Window & { openai?: unknown; appbridge?: unknown };
  return {
    openai: typeof w.openai !== "undefined",
    appbridge: typeof w.appbridge !== "undefined",
  };
}
