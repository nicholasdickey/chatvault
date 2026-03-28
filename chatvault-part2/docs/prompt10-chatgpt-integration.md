# Prompt10: ChatGPT integration and testing (`chatvault-part2`)

This document is the **integration runbook** for connecting ChatGPT (or another MCP-capable host) to the Part 2 backend MCP server and manually verifying the three ChatVault tools.

## Prerequisites

- **Database:** `DATABASE_URL` pointing at PostgreSQL with **pgvector** enabled and migrations applied (`pnpm db:migrate` against that database).
- **Embeddings:** `OPENAI_API_KEY` set in the environment where the server runs (required for `saveChat` and `searchMyChats`).
- **Deployed or reachable URL:** ChatGPT must reach your MCP endpoint over **HTTPS** in normal use. For local development, use a tunnel (e.g. ngrok).

## MCP endpoint

- **Path:** `/mcp` (Streamable HTTP; JSON-RPC over `POST`).
- **Health check (smoke):** `GET /mcp?health=1` should return JSON with `"ok": true`.

Examples:

- Local Next dev (default port): `http://localhost:3000/mcp`
- After tunnel: `https://<your-subdomain>.ngrok-free.app/mcp`
- Vercel: `https://<your-deployment>.vercel.app/mcp`

## Production database

Before testing against a **production** or shared Neon database:

1. Run migrations against that database’s `DATABASE_URL` (same schema as local).
2. Confirm `OPENAI_API_KEY` is set in the hosting environment (e.g. Vercel project settings).

## Local server + ngrok

1. From `chatvault-part2`, configure `.env` / `.env.local` with `DATABASE_URL` and `OPENAI_API_KEY`.
2. Start the app: `pnpm dev` (or `pnpm build && pnpm start` for production mode locally).
3. Install [ngrok](https://ngrok.com/) and expose the app port, e.g. `ngrok http 3000`.
4. Copy the **HTTPS** forwarding URL (ngrok shows something like `https://xxxx.ngrok-free.app`). Your MCP URL is **`{that origin}/mcp`**.

**Note:** ngrok free tier may show an interstitial page; use a paid plan or host-specific workarounds if the MCP client cannot complete TLS handshakes.

## Configuring ChatGPT (high level)

Exact UI labels change over time; the intent is:

1. Open ChatGPT / OpenAI account settings for **developer** or **custom connectors** / **MCP** (per current Apps SDK documentation).
2. Add a **remote MCP server** whose base URL is your **origin** (e.g. `https://xxx.ngrok-free.app`) and path **`/mcp`**, or the full URL `https://xxx.ngrok-free.app/mcp` if the UI asks for a single URL.
3. Save and authenticate if prompted.

Consult the latest **OpenAI Apps SDK / MCP** docs for the exact connector fields and OAuth requirements.

## Manual test checklist (non-negotiables)

Run these from ChatGPT after the connector is connected. You should see corresponding **`[mcp]`** log lines on the server (terminal or Vercel logs).

| Tool | What to verify |
|------|----------------|
| **`saveChat`** | Ask the model to save a chat (or use a dev UI that calls the tool). Confirm success and a returned chat id; check logs for `saveChat_ok` / `saveChat_error`. |
| **`loadMyChats`** | List saved chats for a user id. Confirm pagination / `nextCursor` behavior if the client exposes it. Logs: `loadMyChats_ok`. |
| **`searchMyChats`** | Semantic search over saved chats. Logs: `searchMyChats_ok`, embed logs from `embeddings.ts`. |

**Error handling:** Intentionally omit or break parameters (e.g. wrong tool args) and confirm the user sees a **clear, actionable** message—not a raw stack trace— and JSON-RPC errors in logs where applicable.

**Database operations:** Server logs should show **structured** `logMcp` entries for tool start/success/failure so you can correlate ChatGPT actions with DB work.

## Optional: Part 1 widget

If you have the **Part 1** widget MCP app, you can point it at this backend’s `/mcp` URL (via the same tunnel or production URL) and verify `loadMyChats` / widget flows. Tool names and `structuredContent` shapes are aligned with Part 1 where the tutorial specifies them.

## Vercel

- Set **Environment variables:** `DATABASE_URL`, `OPENAI_API_KEY`, and any embedding model overrides.
- Deploy; use the deployment URL + `/mcp` as the MCP endpoint for ChatGPT.
- Use **Vercel** → **Logs** (or your observability) to watch `logMcp` output during manual tests.

## References

- Tutorial prompts: `prompts/part2/cursor/chatVaultPrompts.md` (Prompt10).
- Local e2e: `README.md` (Part 2 backend tests) and `pnpm test` in `chatvault-part2`.
