import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";

/** Subset of host context used for layout + debug (Prompt 10). */
export type HostLayoutState = {
  displayMode?: McpUiHostContext["displayMode"];
  availableDisplayModes?: McpUiHostContext["availableDisplayModes"];
  safeAreaInsets?: McpUiHostContext["safeAreaInsets"];
  containerDimensions?: McpUiHostContext["containerDimensions"];
};

const LAYOUT_VARS = [
  "--cv-safe-top",
  "--cv-safe-right",
  "--cv-safe-bottom",
  "--cv-safe-left",
  "--cv-host-max-height",
  "--cv-host-max-width",
] as const;

export function pickHostLayoutFromContext(
  ctx: Partial<McpUiHostContext> | undefined,
): HostLayoutState {
  if (!ctx || typeof ctx !== "object") {
    return {};
  }
  const next: HostLayoutState = {};
  if (ctx.displayMode !== undefined) {
    next.displayMode = ctx.displayMode;
  }
  if (ctx.availableDisplayModes !== undefined) {
    next.availableDisplayModes = ctx.availableDisplayModes;
  }
  if (ctx.safeAreaInsets !== undefined) {
    next.safeAreaInsets = ctx.safeAreaInsets;
  }
  if (ctx.containerDimensions !== undefined) {
    next.containerDimensions = ctx.containerDimensions;
  }
  return next;
}

export function clearHostLayoutCssVars(el: HTMLElement): void {
  for (const k of LAYOUT_VARS) {
    el.style.removeProperty(k);
  }
}

/**
 * Apply safe-area and optional container max size from host context (Prompt 10).
 */
export function applyHostLayoutCssVars(
  el: HTMLElement,
  ctx: HostLayoutState | undefined,
): void {
  clearHostLayoutCssVars(el);
  if (!ctx) {
    return;
  }

  const s = ctx.safeAreaInsets;
  el.style.setProperty("--cv-safe-top", `${s?.top ?? 0}px`);
  el.style.setProperty("--cv-safe-right", `${s?.right ?? 0}px`);
  el.style.setProperty("--cv-safe-bottom", `${s?.bottom ?? 0}px`);
  el.style.setProperty("--cv-safe-left", `${s?.left ?? 0}px`);

  const d = ctx.containerDimensions;
  if (d && typeof d === "object") {
    if ("height" in d && typeof d.height === "number") {
      el.style.setProperty("--cv-host-max-height", `${d.height}px`);
    } else if ("maxHeight" in d && d.maxHeight != null) {
      el.style.setProperty("--cv-host-max-height", `${d.maxHeight}px`);
    }
    if ("width" in d && typeof d.width === "number") {
      el.style.setProperty("--cv-host-max-width", `${d.width}px`);
    } else if ("maxWidth" in d && d.maxWidth != null) {
      el.style.setProperty("--cv-host-max-width", `${d.maxWidth}px`);
    }
  }
}

export function formatHostLayoutForEnvSummary(ctx: HostLayoutState): string[] {
  const lines: string[] = [];
  lines.push(`displayMode: ${ctx.displayMode ?? "(unset)"}`);
  lines.push(
    `availableDisplayModes: ${ctx.availableDisplayModes?.join(",") ?? "(unset)"}`,
  );
  const i = ctx.safeAreaInsets;
  if (i) {
    lines.push(
      `safeAreaInsets: t=${i.top} r=${i.right} b=${i.bottom} l=${i.left}`,
    );
  } else {
    lines.push("safeAreaInsets: (unset)");
  }
  const d = ctx.containerDimensions;
  if (d && typeof d === "object") {
    lines.push(`containerDimensions: ${JSON.stringify(d)}`);
  } else {
    lines.push("containerDimensions: (unset)");
  }
  return lines;
}
