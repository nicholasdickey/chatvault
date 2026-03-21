import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DebugPanel } from "./DebugPanel.js";
import "./index.css";

function App() {
  return (
    <main className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        ChatVault MCP App
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Widget bundle with Tailwind and a debug panel (Prompt 4). MCP server
        already exposes <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">testWidget</code>{" "}
        and the HTML resource.
      </p>
      <DebugPanel />
    </main>
  );
}

const root = document.getElementById("chat-vault-root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
