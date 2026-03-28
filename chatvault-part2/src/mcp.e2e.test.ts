/**
 * Prompt5: MCP protocol + session + JSON-RPC smoke tests.
 * Prompt9: saveChat, loadMyChats, searchMyChats + DB assertions + workflow.
 *
 * Requires: Docker Postgres (see docker-compose.yml), DATABASE_URL or .env.test.
 * Optional: OPENAI_API_KEY for save/search tool tests (skipped if unset).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { execSync } from "node:child_process";
import path from "node:path";
import { config as loadEnv } from "dotenv";

import {
  countChatsForUser,
  getChatById,
  insertChatWithEmbedding,
  truncateChats,
  zeroEmbedding,
  type ChatTurn,
} from "@/test/db-test-utils";
import { runMigrations } from "@/test/e2e-migrate";
import {
  getFreePort,
  startNextServer,
  waitForMcpHealth,
} from "@/test/e2e-server";

const envDir = path.join(__dirname, "..");
loadEnv({ path: path.join(envDir, ".env") });
loadEnv({ path: path.join(envDir, ".env.local") });
loadEnv({ path: path.join(envDir, ".env.test") });

const projectRoot = path.resolve(__dirname, "..");
const databaseUrl =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
} as const;

const hasOpenAi = Boolean(
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0,
);

const itWithOpenAi = hasOpenAi ? it : it.skip;

const describeE2e = databaseUrl ? describe : describe.skip;

describeE2e("MCP e2e (Prompt5 + Prompt9)", () => {
  let port: number;
  let base: string;
  let child: ReturnType<typeof startNextServer> | undefined;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    runMigrations(projectRoot, databaseUrl);
    await truncateChats();

    execSync("pnpm run build", {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });

    port = await getFreePort();
    base = `http://127.0.0.1:${port}/mcp`;
    child = startNextServer(projectRoot, port, {
      DATABASE_URL: databaseUrl,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
    });
    child.stderr?.on("data", (d: Buffer) => {
      process.stderr.write(d);
    });

    await waitForMcpHealth(port);
  }, 300000);

  afterAll(async () => {
    child?.kill("SIGTERM");
    child = undefined;
    const { closeDbPool } = await import("@/db");
    await closeDbPool();
  });

  beforeEach(async () => {
    await truncateChats();
  });

  async function initSession(): Promise<{
    sessionHeaders: Record<string, string>;
  }> {
    const initRes = await fetch(base, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "jest-e2e", version: "0.0.1" },
        },
      }),
    });
    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const initJson = (await initRes.json()) as {
      jsonrpc?: string;
      id?: number;
      error?: unknown;
      result?: { protocolVersion?: string };
    };
    expect(initJson.jsonrpc).toBe("2.0");
    expect(initJson.error).toBeUndefined();

    const protocolVersion =
      initJson.result?.protocolVersion ?? "2025-03-26";

    const sessionHeaders: Record<string, string> = {
      ...MCP_HEADERS,
      "mcp-session-id": sessionId!,
      "mcp-protocol-version": protocolVersion,
    };

    const initNotify = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
    expect([202, 204]).toContain(initNotify.status);

    return { sessionHeaders };
  }

  it("GET /mcp?health=1 returns ok JSON (JSON-RPC smoke)", async () => {
    const r = await fetch(`${base}?health=1`);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok?: boolean; service?: string };
    expect(j.ok).toBe(true);
    expect(j.service).toContain("chatvault");
  });

  it("initialize + tools/list includes ChatVault tools (Prompt5)", async () => {
    const { sessionHeaders } = await initSession();

    const toolsList = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });
    expect(toolsList.status).toBe(200);
    const toolsJson = (await toolsList.json()) as {
      jsonrpc?: string;
      result?: { tools?: { name: string }[] };
      error?: unknown;
    };
    expect(toolsJson.jsonrpc).toBe("2.0");
    expect(toolsJson.error).toBeUndefined();
    const toolNames = toolsJson.result?.tools?.map((t) => t.name) ?? [];
    expect(toolNames).toContain("saveChat");
    expect(toolNames).toContain("loadMyChats");
    expect(toolNames).toContain("searchMyChats");
  });

  it("resources/list returns JSON-RPC result (may be empty)", async () => {
    const { sessionHeaders } = await initSession();

    const resourcesList = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "resources/list",
        params: {},
      }),
    });
    expect(resourcesList.status).toBe(200);
    const resJson = (await resourcesList.json()) as {
      jsonrpc?: string;
      error?: { code?: number; message?: string };
      result?: { resources?: unknown[] };
    };
    expect(resJson.jsonrpc).toBe("2.0");
    if (resJson.error) {
      expect(resJson.error.code).toBeDefined();
    } else {
      expect(Array.isArray(resJson.result?.resources)).toBe(true);
    }
  });

  it("loadMyChats returns empty chats for new user (Prompt9)", async () => {
    const { sessionHeaders } = await initSession();
    const uid = `u-empty-${crypto.randomUUID()}`;

    const res = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "loadMyChats",
          arguments: { userId: uid },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: {
        structuredContent?: {
          chats?: unknown[];
          pagination?: { total?: number };
          nextCursor?: string | null;
        };
        isError?: boolean;
      };
      error?: unknown;
    };
    expect(body.error).toBeUndefined();
    expect(body.result?.isError).not.toBe(true);
    const sc = body.result?.structuredContent;
    expect(Array.isArray(sc?.chats)).toBe(true);
    expect(sc?.chats?.length).toBe(0);
    expect(sc?.pagination?.total).toBe(0);
    expect(sc?.nextCursor).toBeNull();
  });

  it("loadMyChats paginates seeded rows and rejects bad cursor (Prompt9)", async () => {
    const uid = `u-page-${crypto.randomUUID()}`;
    const turns: ChatTurn[] = [
      { prompt: "a", response: "b" },
    ];
    const emb = zeroEmbedding();
    await insertChatWithEmbedding(uid, "t1", turns, emb);
    await new Promise((r) => setTimeout(r, 50));
    await insertChatWithEmbedding(uid, "t2", turns, emb);
    await new Promise((r) => setTimeout(r, 50));
    await insertChatWithEmbedding(uid, "t3", turns, emb);

    const { sessionHeaders } = await initSession();

    const p1 = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 20,
        method: "tools/call",
        params: {
          name: "loadMyChats",
          arguments: { userId: uid, limit: 2, page: 1 },
        },
      }),
    });
    expect(p1.status).toBe(200);
    const j1 = (await p1.json()) as {
      result?: {
        structuredContent?: {
          chats?: { title: string }[];
          nextCursor?: string | null;
          pagination?: { page?: number; total?: number; totalPages?: number };
        };
      };
      error?: unknown;
    };
    expect(j1.error).toBeUndefined();
    const sc1 = j1.result?.structuredContent;
    expect(sc1?.chats?.length).toBe(2);
    expect(sc1?.pagination?.total).toBe(3);
    expect(sc1?.nextCursor).toBe("p2");

    const bad = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 21,
        method: "tools/call",
        params: {
          name: "loadMyChats",
          arguments: { userId: uid, cursor: "not-a-cursor" },
        },
      }),
    });
    expect(bad.status).toBe(200);
    const badJson = (await bad.json()) as { error?: unknown; result?: unknown };
    expect(
      badJson.error !== undefined ||
        (badJson.result as { isError?: boolean })?.isError === true,
    ).toBe(true);
  });

  itWithOpenAi("saveChat persists row when OPENAI_API_KEY is set (Prompt9)", async () => {
    const uid = `u-save-${crypto.randomUUID()}`;
    const { sessionHeaders } = await initSession();

    expect(await countChatsForUser(uid)).toBe(0);

    const res = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 30,
        method: "tools/call",
        params: {
          name: "saveChat",
          arguments: {
            userId: uid,
            title: "E2E title",
            turns: [{ prompt: "hello", response: "world" }],
          },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { content?: { text?: string }[]; isError?: boolean };
      error?: unknown;
    };
    expect(body.error).toBeUndefined();
    expect(body.result?.isError).not.toBe(true);
    const text = body.result?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as { chatId?: string };
    expect(parsed.chatId).toBeTruthy();

    expect(await countChatsForUser(uid)).toBe(1);
    const row = await getChatById(parsed.chatId!);
    expect(row?.title).toBe("E2E title");
    expect(row?.userId).toBe(uid);
  });

  itWithOpenAi("searchMyChats ranks results when OPENAI_API_KEY is set (Prompt9)", async () => {
    const uid = `u-search-${crypto.randomUUID()}`;
    const { sessionHeaders } = await initSession();

    const save = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 40,
        method: "tools/call",
        params: {
          name: "saveChat",
          arguments: {
            userId: uid,
            title: "PostgreSQL indexing",
            turns: [
              {
                prompt: "How do I speed up queries?",
                response: "Use indexes and analyze query plans.",
              },
            ],
          },
        },
      }),
    });
    expect(save.status).toBe(200);

    const search = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 41,
        method: "tools/call",
        params: {
          name: "searchMyChats",
          arguments: {
            userId: uid,
            query: "database performance indexes",
            limit: 5,
          },
        },
      }),
    });
    expect(search.status).toBe(200);
    const sJson = (await search.json()) as {
      result?: {
        structuredContent?: {
          chats?: unknown[];
          results?: { cosineDistance: number }[];
          search?: { resultCount?: number };
          nextCursor?: null;
        };
      };
      error?: unknown;
    };
    expect(sJson.error).toBeUndefined();
    const sc = sJson.result?.structuredContent;
    expect((sc?.chats?.length ?? 0) >= 1).toBe(true);
    expect((sc?.search?.resultCount ?? 0) >= 1).toBe(true);
    expect(sc?.nextCursor).toBeNull();
    const dists = sc?.results?.map((r) => r.cosineDistance) ?? [];
    for (let i = 1; i < dists.length; i++) {
      expect(dists[i]! >= dists[i - 1]!).toBe(true);
    }
  });

  itWithOpenAi("workflow save → load → search (Prompt9)", async () => {
    const uid = `u-flow-${crypto.randomUUID()}`;
    const { sessionHeaders } = await initSession();

    const save = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 50,
        method: "tools/call",
        params: {
          name: "saveChat",
          arguments: {
            userId: uid,
            title: "Trip notes",
            turns: [{ prompt: "Paris tips?", response: "Try the museums." }],
          },
        },
      }),
    });
    expect(save.status).toBe(200);

    const load = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 51,
        method: "tools/call",
        params: {
          name: "loadMyChats",
          arguments: { userId: uid },
        },
      }),
    });
    expect(load.status).toBe(200);
    const loadJson = (await load.json()) as {
      result?: { structuredContent?: { chats?: { title: string }[] } };
    };
    expect(loadJson.result?.structuredContent?.chats?.length).toBe(1);
    expect(loadJson.result?.structuredContent?.chats?.[0]?.title).toBe(
      "Trip notes",
    );

    const search = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 52,
        method: "tools/call",
        params: {
          name: "searchMyChats",
          arguments: { userId: uid, query: "Paris museums", limit: 3 },
        },
      }),
    });
    expect(search.status).toBe(200);
    const sJson = (await search.json()) as {
      result?: { structuredContent?: { chats?: unknown[] } };
    };
    expect((sJson.result?.structuredContent?.chats?.length ?? 0) >= 1).toBe(
      true,
    );
  });
});
