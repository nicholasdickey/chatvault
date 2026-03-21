import { useCallback, useEffect, useRef, useState } from "react";

const COPY_OK_MS = 5000;

function ExpandableCopyField({
  label,
  text,
  fieldKey,
}: {
  label: string;
  text: string;
  fieldKey: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const onCopy = useCallback(async () => {
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("ok");
      copyTimerRef.current = setTimeout(() => {
        setCopyState("idle");
        copyTimerRef.current = null;
      }, COPY_OK_MS);
    } catch {
      setCopyState("err");
      copyTimerRef.current = setTimeout(() => {
        setCopyState("idle");
        copyTimerRef.current = null;
      }, 3000);
    }
  }, [text]);

  return (
    <div
      className="rounded-lg border border-[var(--cv-border)] bg-[var(--cv-surface)] p-3"
      data-field-key={fieldKey}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--cv-muted)]">
          {label}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void onCopy();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label={`Copy ${label}`}
        >
          {copyState === "ok" ? (
            <span className="text-emerald-600 dark:text-emerald-400">Copied ✓</span>
          ) : copyState === "err" ? (
            <span className="text-red-600 dark:text-red-400">Copy failed</span>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 w-full text-left"
        aria-expanded={expanded}
      >
        <p
          className={`text-sm text-slate-800 dark:text-slate-100 ${
            expanded ? "" : "line-clamp-2"
          }`}
        >
          {text || "(empty)"}
        </p>
        <span className="mt-1 inline-block text-[11px] text-emerald-700 underline dark:text-emerald-400">
          {expanded ? "Show less" : "Tap to expand full text"}
        </span>
      </button>
    </div>
  );
}

export function ChatTurnBlock({
  turnIndex,
  prompt,
  response,
}: {
  turnIndex: number;
  prompt: string;
  response: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-600">
      <p className="text-xs font-medium text-[var(--cv-muted)]">Turn {turnIndex + 1}</p>
      <ExpandableCopyField
        label="Prompt"
        text={prompt}
        fieldKey={`t${turnIndex}-prompt`}
      />
      <ExpandableCopyField
        label="Response"
        text={response}
        fieldKey={`t${turnIndex}-response`}
      />
    </div>
  );
}
