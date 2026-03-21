# Prompt 9: End-to-end verification (ChatGPT / Claude)

Goal: confirm **ChatGPT or Claude → your MCP server (e.g. Vercel) → widget** and that **server logs** line up with the **widget debug panel** without leaking secrets.

## Where to read server logs

- **Vercel**: Project → Deployment → **Functions** / **Runtime logs** (or your host’s log stream for the Node handler that serves `POST /mcp`).
- **Local**: `pnpm dev` in `chatvault-part1` and watch the terminal where `dev-server.ts` runs.

Structured lines use the **`[mcp]`** prefix (JSON-RPC in/out, `tools/call`, tool dispatch, responses).

## What the server logs (grep-friendly)

1. **`[mcp] jsonrpc-in`** — Each JSON-RPC request: `method`, `id`, top-level **`params` keys**, optional **`session=…`** (shortened session id when header present).
2. **`[mcp] tools/call`** — When `method` is `tools/call`: tool **`name`**, **`id`**, and **`argKeys=…`** for `arguments` (keys only at HTTP layer).
3. **`[mcp] tool dispatch name=browseMySavedChats …`** — **Single canonical line** for browse args: truncated **`portalLink` / `loginLink`**, **`shortAnonId`** preview + length, **`isAnon`**. Full URLs are **not** logged.
4. **`[mcp] tool dispatch name=loadMyChats …`** — `userId` and `cursor` (tutorial data only).
5. **`[mcp] response`** — HTTP status, response **byte length**, JSON-RPC **outcome** (`result` / `error`), **`id`**, optional **`session=…`**.

## Manual checklist (happy path)

1. Connect the MCP app in ChatGPT (or Claude) to your deployed **`…/mcp`** URL (or local tunnel).
2. Invoke **`browseMySavedChats`** with known test values, e.g.:
   - `shortAnonId`: a short test string you can recognize.
   - `portalLink` / `loginLink`: real `https://…` URLs you control (or staging).
3. In **server logs**, find:
   - `[mcp] tools/call` with `name=browseMySavedChats`.
   - `[mcp] tool dispatch name=browseMySavedChats` with the **same** anon preview and **truncated** URLs matching your inputs.
4. Open the **widget** in the host UI. In the **Debug panel**:
   - **Bootstrap meta (chatVault / browse context)** should show the same **`shortAnonId`** and links (full values are OK in the widget; server stays redacted).
   - **Environment** / **Widget log** should show embedded connection and `loadMyChats` activity.
5. Confirm **`loadMyChats`** still returns data: server log `tool dispatch name=loadMyChats` and widget list populated (or fixture fallback if host tools are off).

## Error / edge paths

Behavior depends on the **host** (ChatGPT/Claude), not only this repo:

- **Missing portal link**: widget empty state and bootstrap meta should reflect missing `portalLink`; server browse log shows `portalLink=absent`.
- **Invalid token / auth / rate limits**: expect a JSON-RPC **`error`** in **`[mcp] response outcome=error`**, and the widget **host / connection** or tool-result sections may show a failure. You do not need to simulate these in code—just know to check **both** log streams when debugging.

## Correlation tip

When **`mcp-session-id`** is sent on requests, **`jsonrpc-in`**, **`tools/call`**, and **`response`** lines include a shortened **`session=…`** suffix so concurrent sessions on the same deployment are easier to tell apart.
