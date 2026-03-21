import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  formatLogLine,
  getWidgetLogSnapshot,
  logToolCall,
  logWidget,
  subscribeWidgetLog,
} from "./widget-log.js";

function logEnvironment(): void {
  logWidget("mount", "Widget mounted (Prompt 4)");

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

  logWidget(
    "tool",
    "Tool calls from the host will appear here when appbridge/OpenAI calls server tools.",
  );
}

export function DebugPanel() {
  const snapshot = useSyncExternalStore(
    subscribeWidgetLog,
    getWidgetLogSnapshot,
    getWidgetLogSnapshot,
  );

  useEffect(() => {
    logEnvironment();

    const onError = (ev: ErrorEvent) => {
      const msg =
        ev.message ||
        (ev.error instanceof Error ? ev.error.message : String(ev.error));
      logWidget("error", msg);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      const msg = r instanceof Error ? r.message : String(r);
      logWidget("error", `unhandledrejection: ${msg}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const simulateTool = useCallback(() => {
    logToolCall("simulate", `clicked at ${new Date().toISOString()}`);
  }, []);

  const text = snapshot.map(formatLogLine).join("\n");

  return (
    <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-950">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">
        Debug panel
      </summary>
      <div className="space-y-2 border-t border-slate-200 px-2 py-2 dark:border-slate-700">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={simulateTool}
        >
          Simulate tool log line
        </button>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-white p-2 font-mono text-[10px] text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
          {text}
        </pre>
      </div>
    </details>
  );
}
