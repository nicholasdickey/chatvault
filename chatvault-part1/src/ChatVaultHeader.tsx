import type { ChatVaultBrowseContext } from "./chatvault-types.js";

export function ChatVaultHeader({
  browse,
  standalone,
}: {
  browse: ChatVaultBrowseContext;
  standalone: boolean;
}) {
  const viewerLabel = standalone
    ? "Local preview (no MCP host)"
    : browse.shortAnonId
      ? `Viewer / user id: ${browse.shortAnonId.slice(0, 16)}${browse.shortAnonId.length > 16 ? "…" : ""}`
      : "Signed-in viewer (no short id from host yet)";

  return (
    <header className="cv-surface rounded-xl border border-[var(--cv-border)] bg-[var(--cv-surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
            ChatVault – Saved Chats
          </h1>
          <p className="mt-1 text-sm text-[var(--cv-muted)]">{viewerLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {browse.portalLink ? (
            <a
              href={browse.portalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              Open full app
            </a>
          ) : null}
          {browse.loginLink ? (
            <a
              href={browse.loginLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${
                browse.isAnon === true
                  ? "ring-2 ring-amber-400/80 ring-offset-2 ring-offset-[var(--cv-bg)] dark:ring-amber-500/70"
                  : ""
              }`}
            >
              Sign in / create account
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
