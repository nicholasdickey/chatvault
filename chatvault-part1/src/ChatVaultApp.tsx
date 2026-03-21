import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boundedJsonStringify } from "./chatvault-debug-serialize.js";
import { loadMyChatsFixture } from "./chatvault-fixtures.js";
import { ChatHistoryPanel } from "./ChatHistoryPanel.js";
import { ChatVaultHeader } from "./ChatVaultHeader.js";
import { DebugPanel } from "./DebugPanel.js";
import {
  getWidgetBootstrapMeta,
  hostSupportsServerTools,
  loadChatsForWidget,
  parseBrowseContextFromArguments,
  parseChatVaultFromToolResult,
  summarizeBrowseContext,
} from "./chatvault-host.js";
import { installDataThemeListener } from "./chatvault-theme.js";
import type { Chat, ChatVaultBrowseContext } from "./chatvault-types.js";
import { CHATVAULT_WIDGET_APP_INFO } from "./chatvault-widget-meta.js";
import { logToolCall, logWidget } from "./widget-log.js";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary.js";

/** Fixed `userId` when host does not supply `shortAnonId` (Prompt 7 — widget does not set credentials). */
const WIDGET_DEFAULT_USER_ID = "widget-user";

function chatKey(c: Chat): string {
  return `${c.title}::${c.timestamp}`;
}

function mergeChats(existing: Chat[], more: Chat[]): Chat[] {
  const seen = new Set(existing.map(chatKey));
  return [...existing, ...more.filter((c) => !seen.has(chatKey(c)))];
}

function metaKeys(result: { _meta?: unknown }): string {
  const m = result._meta;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    return Object.keys(m as object).join(",");
  }
  return "";
}

export function ChatVaultApp() {
  const browseRef = useRef<ChatVaultBrowseContext>({});
  const [browseEpoch, setBrowseEpoch] = useState(0);
  const [browseCtx, setBrowseCtx] = useState<ChatVaultBrowseContext>({});
  const [lastToolMeta, setLastToolMeta] = useState<unknown>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [dataTheme, setDataTheme] = useState<string | undefined>(() =>
    typeof document !== "undefined"
      ? document.documentElement.dataset.theme
      : undefined,
  );

  const standalone =
    typeof window !== "undefined" &&
    window.parent === window &&
    (window as Window & { openai?: unknown }).openai === undefined;

  const { app, isConnected, error } = useApp({
    appInfo: CHATVAULT_WIDGET_APP_INFO,
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = (p) => {
        const ctx = parseBrowseContextFromArguments(p.arguments);
        browseRef.current = { ...browseRef.current, ...ctx };
        setBrowseCtx({ ...browseRef.current });
        logWidget("browse", `tool-input ${summarizeBrowseContext(ctx)}`);
        setBrowseEpoch((n) => n + 1);
      };
      a.ontoolresult = (r) => {
        setLastToolMeta(r._meta ?? null);
        const fromMeta = parseChatVaultFromToolResult(r);
        if (Object.keys(fromMeta).length > 0) {
          browseRef.current = { ...browseRef.current, ...fromMeta };
          setBrowseCtx({ ...browseRef.current });
        }
        logWidget("browse", `tool-result _meta keys: ${metaKeys(r)}`);
        setBrowseEpoch((n) => n + 1);
      };
    },
  });

  useEffect(
    () =>
      installDataThemeListener(() => {
        setDataTheme(document.documentElement.dataset.theme);
      }),
    [],
  );

  useEffect(() => {
    if (standalone) {
      logWidget(
        "init",
        "Standalone preview: no MCP Apps host; using hardcoded chats.",
      );
      return;
    }
    const serverTools = app ? hostSupportsServerTools(app) : false;
    logWidget(
      "init",
      `Embedded: connected=${isConnected} serverTools=${serverTools} browse=${summarizeBrowseContext(browseRef.current)}`,
    );
  }, [standalone, app, isConnected, browseEpoch]);

  useEffect(() => {
    if (error) {
      logWidget("host", `MCP App connect: ${error.message}`);
    }
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    setSelectedChat(null);

    void (async () => {
      if (standalone) {
        setLoadState("loading");
        const data = loadMyChatsFixture(WIDGET_DEFAULT_USER_ID);
        if (!cancelled) {
          setChats(data.chats);
          setNextCursor(data.nextCursor);
          setLoadState("ready");
          logToolCall(
            "loadMyChats",
            `fixture userId=${WIDGET_DEFAULT_USER_ID} cursor=none -> chats=${data.chats.length} next=${data.nextCursor ?? "null"}`,
          );
          logWidget(
            "loadMyChats",
            `fixture standalone count=${data.chats.length}`,
          );
        }
        return;
      }

      if (!app || !isConnected) {
        if (error) {
          setLoadState("loading");
          const data = loadMyChatsFixture(WIDGET_DEFAULT_USER_ID);
          if (!cancelled) {
            setChats(data.chats);
            setNextCursor(data.nextCursor);
            setLoadState("ready");
            logToolCall(
              "loadMyChats",
              `fixture after host error userId=${WIDGET_DEFAULT_USER_ID} -> chats=${data.chats.length} next=${data.nextCursor ?? "null"}`,
            );
            logWidget(
              "loadMyChats",
              `fixture after host error count=${data.chats.length}`,
            );
          }
        } else {
          if (!cancelled) {
            setChats([]);
            setNextCursor(null);
            setLoadState("loading");
          }
        }
        return;
      }

      setLoadState("loading");
      setChats([]);
      setNextCursor(null);

      const userId =
        browseRef.current.shortAnonId?.trim() || WIDGET_DEFAULT_USER_ID;
      logWidget("loadMyChats", `request userId=${userId}`);
      const { source, data } = await loadChatsForWidget(
        app,
        isConnected,
        userId,
      );
      if (!cancelled) {
        setChats(data.chats);
        setNextCursor(data.nextCursor);
        setLoadState("ready");
        logToolCall(
          "loadMyChats",
          `callServerTool name=loadMyChats userId=${userId} cursor=none source=${source} -> chats=${data.chats.length} nextCursor=${data.nextCursor ?? "null"}`,
        );
        logWidget(
          "loadMyChats",
          `done source=${source} count=${data.chats.length} next=${data.nextCursor ?? "null"}`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [standalone, app, isConnected, error, browseEpoch]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }
    const userId =
      browseRef.current.shortAnonId?.trim() || WIDGET_DEFAULT_USER_ID;
    setLoadingMore(true);
    try {
      const { source, data } = await loadChatsForWidget(
        app,
        isConnected,
        userId,
        nextCursor,
      );
      setChats((prev) => mergeChats(prev, data.chats));
      setNextCursor(data.nextCursor);
      logToolCall(
        "loadMyChats",
        `callServerTool name=loadMyChats userId=${userId} cursor=${nextCursor} source=${source} -> +${data.chats.length} nextCursor=${data.nextCursor ?? "null"}`,
      );
      logWidget(
        "loadMyChats",
        `page source=${source} added=${data.chats.length} next=${data.nextCursor ?? "null"}`,
      );
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, app, isConnected]);

  const toolResultMetaJson = useMemo((): string | null => {
    if (lastToolMeta === null || lastToolMeta === undefined) {
      return null;
    }
    return boundedJsonStringify(lastToolMeta);
  }, [lastToolMeta]);

  const bootstrapMetaJson = useMemo(() => {
    return boundedJsonStringify(getWidgetBootstrapMeta(browseCtx));
  }, [browseCtx]);

  const envSummary = useMemo(() => {
    const iframe = typeof window !== "undefined" && window.self !== window.top;
    const serverTools =
      app === null || app === undefined
        ? "n/a"
        : String(hostSupportsServerTools(app));
    return [
      `data-theme: ${dataTheme ?? "(unset)"}`,
      `standalone: ${standalone}`,
      `iframe: ${iframe}`,
      `isConnected: ${isConnected}`,
      `serverTools: ${serverTools}`,
      `browse: ${summarizeBrowseContext(browseCtx)}`,
    ].join("\n");
  }, [dataTheme, standalone, isConnected, app, browseCtx]);

  const waitingForHost =
    !standalone && !error && (!app || !isConnected) && loadState === "loading";

  const emptyHint =
    browseCtx.portalLink === undefined
      ? "Run browseMySavedChats from ChatGPT or use the full app when available."
      : "Nothing in this preview yet — open the full app to add chats.";

  const mainScrollClass = standalone
    ? "mt-4"
    : "mt-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1";

  return (
    <div
      className={`box-border bg-[var(--cv-bg)] p-4 text-slate-800 dark:text-slate-100 ${
        standalone
          ? "min-h-screen"
          : "flex h-full min-h-[54rem] max-h-[min(90dvh,72rem)] flex-1 flex-col overflow-hidden"
      }`}
    >
      <WidgetErrorBoundary>
        <div
          className={
            standalone ? "" : "flex min-h-0 flex-1 flex-col overflow-hidden"
          }
        >
          <ChatVaultHeader browse={browseCtx} standalone={standalone} />

          {error && !standalone ? (
            <div
              className="mt-3 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              Host connection issue — showing sample data when available.{" "}
              <span className="opacity-80">{error.message}</span>
            </div>
          ) : null}

          {waitingForHost ? (
            <p
              className="mt-2 shrink-0 text-xs text-[var(--cv-muted)]"
              role="status"
              aria-live="polite"
            >
              {app
                ? "Waiting for MCP Apps host…"
                : "Connecting to MCP Apps host…"}
            </p>
          ) : null}

          <div className={mainScrollClass}>
            <ChatHistoryPanel
              chats={chats}
              selected={selectedChat}
              onSelect={setSelectedChat}
              onBack={() => setSelectedChat(null)}
              loading={loadState === "loading" && chats.length === 0}
              loadingMore={loadingMore}
              hasMore={nextCursor !== null && nextCursor !== undefined}
              onLoadMore={() => void handleLoadMore()}
              portalLink={browseCtx.portalLink}
              emptyHint={emptyHint}
            />
          </div>
        </div>
      </WidgetErrorBoundary>

      <div className={standalone ? "mt-4" : "mt-4 shrink-0"}>
        <DebugPanel
          toolResultMetaJson={toolResultMetaJson}
          bootstrapMetaJson={bootstrapMetaJson}
          envSummary={envSummary}
        />
      </div>
    </div>
  );
}
