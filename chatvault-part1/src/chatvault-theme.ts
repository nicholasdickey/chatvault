/** Sync `data-theme` on `<html>` for ChatVault (Prompt 7) — pairs with CSS variables. */
export function syncDataThemeFromMedia(): void {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Install listener; optional `onThemeApplied` runs after each sync (e.g. React debug state). */
export function installDataThemeListener(onThemeApplied?: () => void): () => void {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    syncDataThemeFromMedia();
    onThemeApplied?.();
  };
  mql.addEventListener("change", onChange);
  syncDataThemeFromMedia();
  onThemeApplied?.();
  return () => mql.removeEventListener("change", onChange);
}
