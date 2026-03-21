import { StrictMode, useEffect, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { ChatVaultApp } from "./ChatVaultApp.js";
import "./index.css";
import { logWidget } from "./widget-log.js";

function App() {
  useLayoutEffect(() => {
    const embedded = window.self !== window.top;
    document.documentElement.classList.toggle("cv-embedded", embedded);
    return () => {
      document.documentElement.classList.remove("cv-embedded");
    };
  }, []);

  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      const msg =
        ev.message ||
        (ev.error instanceof Error ? ev.error.message : String(ev.error));
      logWidget("error", msg);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      const msg = r instanceof Error ? r.message : String(r);
      logWidget("error", `unhandledrejection: ${msg}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return <ChatVaultApp />;
}

const root = document.getElementById("chat-vault-root");
if (root) {
  try {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    root.innerHTML = `<p style="padding:1rem;font-family:system-ui;color:#b91c1c">ChatVault failed to start: ${msg}</p>`;
    console.error(e);
  }
} else {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<p style="padding:1rem;font-family:system-ui;color:#b91c1c">Missing #chat-vault-root — check mcp-app.html.</p>',
  );
}
