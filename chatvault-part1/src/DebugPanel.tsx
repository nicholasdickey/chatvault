import type { App, McpUiDisplayMode } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { boundedJsonStringify } from "./chatvault-debug-serialize.js";
import {
  formatLogLine,
  getWidgetLogSnapshot,
  logToolCall,
  logWidget,
  subscribeWidgetLog,
} from "./widget-log.js";
import {
  getOutboundToolLogSnapshot,
  subscribeOutboundToolLog,
} from "./widget-outbound-tool-log.js";

function detectEnvironmentToLog(): void {
  logWidget("mount", "ChatVault widget mounted");

  const loc = window.location;
  const path =
    loc.pathname.length > 80 ? `${loc.pathname.slice(0, 77)}...` : loc.pathname;
  logWidget("env", `location ${loc.origin}${path}`);

  const inIframe = window.self !== window.top;
  logWidget("env", `iframe ${inIframe ? "yes" : "no"}`);

  const w = window as Window & { openai?: unknown; appbridge?: unknown };
  logWidget(
    "env",
    `window.openai ${typeof w.openai !== "undefined" ? "present" : "absent"}`,
  );
  logWidget(
    "env",
    `window.appbridge ${typeof w.appbridge !== "undefined" ? "present" : "absent"}`,
  );

  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  logWidget("env", `prefers-color-scheme ${dark ? "dark" : "light"}`);
}

const DEFAULT_DISPLAY_MODES: McpUiDisplayMode[] = [
  "inline",
  "fullscreen",
  "pip",
];

function DisplayModeRequests({
  app,
  canRequest,
  availableDisplayModes,
}: {
  app: App | null;
  canRequest: boolean;
  availableDisplayModes: McpUiDisplayMode[] | undefined;
}) {
  const modes =
    availableDisplayModes && availableDisplayModes.length > 0
      ? availableDisplayModes
      : DEFAULT_DISPLAY_MODES;

  const requestMode = useCallback(
    async (mode: McpUiDisplayMode) => {
      if (!app) {
        return;
      }
      try {
        const result = await app.requestDisplayMode({ mode });
        logWidget(
          "display",
          `requestDisplayMode ${mode} ok mode=${String((result as { mode?: string }).mode ?? "?")}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logWidget("display", `requestDisplayMode ${mode} failed: ${msg}`);
      }
    },
    [app],
  );

  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          disabled={!canRequest}
          onClick={() => void requestMode(mode)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Request {mode}
        </button>
      ))}
    </div>
  );
}

export function DebugPanel({
  hostToolResultSummaryJson,
  toolResultMetaJson,
  bootstrapMetaJson,
  envSummary,
  displayModeControls,
}: {
  hostToolResultSummaryJson: string | null;
  toolResultMetaJson: string | null;
  bootstrapMetaJson: string;
  envSummary: string;
  displayModeControls?: {
    app: App | null;
    canRequest: boolean;
    availableDisplayModes: McpUiDisplayMode[] | undefined;
  };
}) {
  const snapshot = useSyncExternalStore(
    subscribeWidgetLog,
    getWidgetLogSnapshot,
    getWidgetLogSnapshot,
  );

  const outboundSnapshot = useSyncExternalStore(
    subscribeOutboundToolLog,
    getOutboundToolLogSnapshot,
    getOutboundToolLogSnapshot,
  );

  const hostFullBlock = useMemo(() => {
    if (!hostToolResultSummaryJson || hostToolResultSummaryJson.length === 0) {
      return "(none yet — waiting for host ui/notifications/tool-result)";
    }
    return hostToolResultSummaryJson;
  }, [hostToolResultSummaryJson]);

  const metaBlock = useMemo(() => {
    if (!toolResultMetaJson || toolResultMetaJson.length === 0) {
      return "(none — no _meta on last host tool result yet)";
    }
    return toolResultMetaJson;
  }, [toolResultMetaJson]);

  const bootstrapBlock = useMemo(() => {
    if (!bootstrapMetaJson || bootstrapMetaJson === "{}") {
      return "(empty — no browse context yet)";
    }
    return bootstrapMetaJson;
  }, [bootstrapMetaJson]);

  const outboundBlock = useMemo(() => {
    if (outboundSnapshot.length === 0) {
      return "(no loadMyChats attempts yet)";
    }
    return boundedJsonStringify([...outboundSnapshot]);
  }, [outboundSnapshot]);

  useEffect(() => {
    detectEnvironmentToLog();
  }, []);

  const simulateTool = useCallback(() => {
    logToolCall("simulate", `clicked at ${new Date().toISOString()}`);
  }, []);

  const text = snapshot.map(formatLogLine).join("\n");

  return (
    <details className="debug-panel mt-6 rounded-lg border border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-950">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">
        Debug panel
      </summary>
      <div className="space-y-2 border-t border-slate-200 px-2 py-2 dark:border-slate-700">
        <details className="rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Last host tool result (summary)
          </summary>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 p-2 font-mono text-[10px] text-slate-800 dark:border-slate-600 dark:text-slate-200">
            {hostFullBlock}
          </pre>
        </details>

        <details className="rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Host _meta only (last tool result)
          </summary>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 p-2 font-mono text-[10px] text-slate-800 dark:border-slate-600 dark:text-slate-200">
            {metaBlock}
          </pre>
        </details>

        <details className="rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Widget → server tool calls (loadMyChats)
          </summary>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 p-2 font-mono text-[10px] text-slate-800 dark:border-slate-600 dark:text-slate-200">
            {outboundBlock}
          </pre>
        </details>

        <details className="rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Bootstrap meta (chatVault / browse context)
          </summary>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 p-2 font-mono text-[10px] text-slate-800 dark:border-slate-600 dark:text-slate-200">
            {bootstrapBlock}
          </pre>
        </details>

        <details className="rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Display mode (Prompt 10)
          </summary>
          <div className="border-t border-slate-200 p-2 dark:border-slate-600">
            <p className="mb-2 text-[10px] text-[var(--cv-muted)]">
              Uses <code className="text-[9px]">App.requestDisplayMode</code> (MCP
              Apps SDK). Host may ignore unsupported modes.
            </p>
            {displayModeControls ? (
              <DisplayModeRequests
                app={displayModeControls.app}
                canRequest={displayModeControls.canRequest}
                availableDisplayModes={
                  displayModeControls.availableDisplayModes
                }
              />
            ) : (
              <p className="text-[10px] text-[var(--cv-muted)]">
                (controls only in embedded host)
              </p>
            )}
          </div>
        </details>

        <details className="rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Environment
          </summary>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap border-t border-slate-200 p-2 font-mono text-[10px] text-slate-800 dark:border-slate-600 dark:text-slate-200">
            {envSummary}
          </pre>
        </details>

        <details className="rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900" open>
          <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            Widget log
          </summary>
          <div className="border-t border-slate-200 p-2 dark:border-slate-600">
            <button
              type="button"
              onClick={simulateTool}
              className="mb-2 rounded bg-slate-200 px-2 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Simulate tool log
            </button>
            <pre className="debug-panel__pre max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] leading-snug text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
              {text.length > 0 ? text : "(no entries yet)"}
            </pre>
          </div>
        </details>
      </div>
    </details>
  );
}
