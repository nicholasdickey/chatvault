const DEFAULT_MAX = 10_000;

/** Pretty-print JSON for debug UI; cap length to avoid huge renders. */
export function boundedJsonStringify(
  value: unknown,
  maxChars = DEFAULT_MAX,
): string {
  if (value === undefined || value === null) {
    return value === null ? "null" : "(undefined)";
  }
  try {
    const s = JSON.stringify(value, null, 2);
    if (s.length <= maxChars) {
      return s;
    }
    return `${s.slice(0, maxChars)}\n… (truncated, ${s.length} chars total)`;
  } catch {
    return String(value);
  }
}
