export type WidgetLogLine = { t: number; category: string; message: string };

const lines: WidgetLogLine[] = [];
const listeners = new Set<() => void>();

const MAX_LINES = 200;

function notify(): void {
  for (const l of listeners) {
    l();
  }
}

export function logWidget(category: string, message: string): void {
  lines.push({ t: Date.now(), category, message });
  if (lines.length > MAX_LINES) {
    lines.splice(0, lines.length - MAX_LINES);
  }
  notify();
}

export function logToolCall(name: string, detail: string): void {
  logWidget("tool", `${name}: ${detail}`);
}

export function getWidgetLogSnapshot(): readonly WidgetLogLine[] {
  return lines;
}

export function subscribeWidgetLog(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function formatLogLine(line: WidgetLogLine): string {
  const iso = new Date(line.t).toISOString();
  return `[${iso}] [${line.category}] ${line.message}`;
}
