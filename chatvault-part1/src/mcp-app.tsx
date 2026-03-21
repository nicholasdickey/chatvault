import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <main>
      <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
        ChatVault MCP App
      </h1>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "#334155" }}>
        Widget scaffold (Prompt 2). MCP server wiring comes in Prompt 3.
      </p>
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
