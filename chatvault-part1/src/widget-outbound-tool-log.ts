export type OutboundToolCallEntry = {
  t: number;
  /** How the widget obtained data (MCP host vs local fixture). */
  method: "callServerTool" | "fixture";
  toolName: "loadMyChats";
  args: { userId: string; cursor?: string | null };
  outcome: string;
  resultShape: { chatCount: number; nextCursor: string | null };
};

const entries: OutboundToolCallEntry[] = [];
const listeners = new Set<() => void>();

const MAX_ENTRIES = 20;

function notify(): void {
  for (const l of listeners) {
    l();
  }
}

export function recordOutboundLoadMyChats(entry: Omit<OutboundToolCallEntry, "t">): void {
  entries.push({ ...entry, t: Date.now() });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  notify();
}

export function getOutboundToolLogSnapshot(): readonly OutboundToolCallEntry[] {
  return entries;
}

export function subscribeOutboundToolLog(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
