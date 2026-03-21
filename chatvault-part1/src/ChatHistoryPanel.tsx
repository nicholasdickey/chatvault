import type { Chat } from "./chatvault-types.js";
import { ChatTurnBlock } from "./ChatTurnBlock.js";

function formatChatWhen(ts: string): string {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) {
      return ts;
    }
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return ts;
  }
}

export function ChatHistoryPanel({
  chats,
  selected,
  onSelect,
  onBack,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  portalLink,
  emptyHint,
}: {
  chats: Chat[];
  selected: Chat | null;
  onSelect: (c: Chat) => void;
  onBack: () => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  portalLink?: string;
  emptyHint: string;
}) {
  if (loading && chats.length === 0) {
    return (
      <div
        className="cv-surface rounded-xl border border-[var(--cv-border)] bg-[var(--cv-surface)] p-8 text-center text-sm text-[var(--cv-muted)]"
        role="status"
      >
        <p className="font-medium text-slate-700 dark:text-slate-200">
          Loading saved chats…
        </p>
        <p className="mt-2 text-xs">Connecting to host or fetching history.</p>
      </div>
    );
  }

  if (!loading && chats.length === 0) {
    return (
      <div
        className="cv-surface rounded-xl border border-[var(--cv-border)] bg-[var(--cv-surface)] p-8 text-center"
        role="status"
      >
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          No saved chats yet
        </p>
        <p className="mt-2 text-sm text-[var(--cv-muted)]">{emptyHint}</p>
        {portalLink ? (
          <a
            href={portalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            Open ChatVault app
          </a>
        ) : null}
      </div>
    );
  }

  if (selected) {
    return (
      <div className="cv-surface rounded-xl border border-[var(--cv-border)] bg-[var(--cv-surface)] p-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-sm font-medium text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          ← Back to list
        </button>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {selected.title}
        </h2>
        <p className="mt-1 text-xs text-[var(--cv-muted)]">
          {formatChatWhen(selected.timestamp)}
        </p>
        <div className="mt-4 space-y-4">
          {selected.turns.map((t, i) => (
            <ChatTurnBlock
              key={`${selected.title}-${selected.timestamp}-${i}`}
              turnIndex={i}
              prompt={t.prompt}
              response={t.response}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="cv-surface rounded-xl border border-[var(--cv-border)] bg-[var(--cv-surface)]">
      <ul className="divide-y divide-slate-200 dark:divide-slate-600">
        {chats.map((c) => (
          <li key={`${c.title}\0${c.timestamp}`}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
            >
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {c.title}
              </span>
              <span className="text-xs text-[var(--cv-muted)]">
                {formatChatWhen(c.timestamp)} · {c.turns.length} turn
                {c.turns.length === 1 ? "" : "s"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <div className="border-t border-[var(--cv-border)] p-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
