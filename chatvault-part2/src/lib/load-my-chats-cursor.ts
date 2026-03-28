/** Max page size for `loadMyChats` (abuse guard). */
export const LOAD_MY_CHATS_MAX_LIMIT = 100;

const CURSOR_RE = /^p(\d+)$/;

/**
 * When `cursor` is set (Part 1 widget), it selects the page and wins over `page`.
 * Format matches Part 1 fixtures: `"p2"` → page 2, `"p3"` → page 3, etc.
 */
export function resolveLoadMyChatsPage(
  cursor: string | undefined,
  page: number,
): number {
  if (cursor !== undefined && cursor !== "") {
    const m = CURSOR_RE.exec(cursor.trim());
    if (!m) {
      return -1;
    }
    const p = parseInt(m[1], 10);
    if (p < 1) {
      return -1;
    }
    return p;
  }
  return page;
}

export function clampLoadMyChatsLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) {
    return 1;
  }
  return Math.min(Math.floor(limit), LOAD_MY_CHATS_MAX_LIMIT);
}

/** `null` when there is no next page. */
export function nextCursorAfterPage(
  currentPage: number,
  totalPages: number,
): string | null {
  if (totalPages <= 0 || currentPage >= totalPages) {
    return null;
  }
  return `p${currentPage + 1}`;
}

export function totalPagesFromTotal(total: number, limit: number): number {
  if (total <= 0 || limit <= 0) {
    return 0;
  }
  return Math.ceil(total / limit);
}
