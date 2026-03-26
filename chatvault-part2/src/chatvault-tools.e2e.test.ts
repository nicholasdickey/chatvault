import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { eq } from "drizzle-orm";
import { initDatabase } from "./db/init.js";
import { db } from "./db/client.js";
import { chats } from "./db/schema.js";
import { closeAllTransports } from "./mcp/httpServer.js";
import type { ChatVaultServer } from "./server.js";
import { startChatVaultServer } from "./server.js";
import {
  countChatsForUser,
  embeddingUnitVector,
  seedChatRow,
  uniqueTestUserId,
} from "./test/chatvaultTestHelpers.js";
import { truncateAllUserTables } from "./test/dbTestUtils.js";
import { McpHttpClient } from "./test/mcpHttpClient.js";

const openaiEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());

async function readySession(client: McpHttpClient): Promise<void> {
  await client.initialize(1);
  await client.sendInitializedNotification();
}

function toolResult(body: unknown): {
  content?: unknown;
  structuredContent?: unknown;
  _meta?: unknown;
  isError?: boolean;
} {
  const r = body as { result?: { content?: unknown; structuredContent?: unknown; _meta?: unknown; isError?: boolean } };
  return r.result ?? {};
}

describe("ChatVault tools e2e (Prompt9)", () => {
  let server: ChatVaultServer;

  beforeAll(async () => {
    await initDatabase();
    await truncateAllUserTables();
    server = await startChatVaultServer({ port: 0, skipDatabaseInit: true });
  }, 120000);

  beforeEach(async () => {
    await truncateAllUserTables();
    await closeAllTransports(server.transports);
  });

  afterAll(async () => {
    await server.close();
  });

  describe("Tier A: loadChats + validation (DB-seeded, no OpenAI)", () => {
    it("loadChats returns empty chats and total 0 for user with no rows", async () => {
      const userId = uniqueTestUserId();
      expect(await countChatsForUser(userId)).toBe(0);

      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const { res, body } = await client.callTool("loadChats", { userId, page: 1, limit: 10 }, 20);
      expect(res.status).toBe(200);
      const tr = toolResult(body);
      expect(tr.isError).not.toBe(true);
      const sc = tr.structuredContent as {
        chats: unknown[];
        pagination: { total: number; page: number; limit: number };
      };
      expect(sc.chats).toEqual([]);
      expect(sc.pagination.total).toBe(0);
      expect(tr._meta).toEqual(tr.structuredContent);
    });

    it("loadChats returns Part 1 Chat shape and pagination", async () => {
      const userId = uniqueTestUserId();
      const turns: { prompt: string; response: string }[] = [
        { prompt: "hi", response: "hello" },
      ];
      await seedChatRow({
        userId,
        title: "A",
        turns,
        embedding: embeddingUnitVector(0),
        timestamp: new Date("2020-01-01T00:00:00.000Z"),
      });
      await seedChatRow({
        userId,
        title: "B",
        turns,
        embedding: embeddingUnitVector(1),
        timestamp: new Date("2024-06-01T12:00:00.000Z"),
      });
      expect(await countChatsForUser(userId)).toBe(2);

      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const { res, body } = await client.callTool("loadChats", { userId, page: 1, limit: 10 }, 21);
      expect(res.status).toBe(200);
      const tr = toolResult(body);
      const sc = tr.structuredContent as {
        chats: Array<{ title: string; timestamp: string; turns: typeof turns }>;
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasMore: boolean;
        };
      };
      expect(sc.pagination.total).toBe(2);
      expect(sc.pagination.page).toBe(1);
      expect(sc.pagination.limit).toBe(10);
      expect(sc.pagination.totalPages).toBe(1);
      expect(sc.pagination.hasMore).toBe(false);
      expect(sc.chats).toHaveLength(2);
      expect(sc.chats[0].title).toBe("B");
      expect(sc.chats[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(sc.chats[0].turns).toEqual(turns);
      expect(sc.chats[1].title).toBe("A");
    });

    it("loadChats paginates page 2", async () => {
      const userId = uniqueTestUserId();
      const turns = [{ prompt: "p", response: "r" }];
      await seedChatRow({
        userId,
        title: "old",
        turns,
        embedding: embeddingUnitVector(2),
        timestamp: new Date("2020-01-01T00:00:00.000Z"),
      });
      await seedChatRow({
        userId,
        title: "new",
        turns,
        embedding: embeddingUnitVector(3),
        timestamp: new Date("2025-01-01T00:00:00.000Z"),
      });

      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const { body } = await client.callTool("loadChats", { userId, page: 1, limit: 1 }, 22);
      const tr1 = toolResult(body);
      const sc1 = tr1.structuredContent as { chats: { title: string }[]; pagination: { hasMore: boolean } };
      expect(sc1.chats).toHaveLength(1);
      expect(sc1.chats[0].title).toBe("new");
      expect(sc1.pagination.hasMore).toBe(true);

      const { body: body2 } = await client.callTool("loadChats", { userId, page: 2, limit: 1 }, 23);
      const tr2 = toolResult(body2);
      const sc2 = tr2.structuredContent as { chats: { title: string }[] };
      expect(sc2.chats).toHaveLength(1);
      expect(sc2.chats[0].title).toBe("old");
    });

    it("loadChats fails validation without userId", async () => {
      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const { res, body } = await client.callTool("loadChats", { page: 1 }, 24);
      expect(res.status).toBe(200);
      const tr = toolResult(body);
      expect(tr.isError).toBe(true);
    });

    it("saveChat fails validation without userId (no OpenAI call)", async () => {
      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const { res, body } = await client.callTool(
        "saveChat",
        {
          title: "t",
          turns: [{ prompt: "a", response: "b" }],
        },
        25,
      );
      expect(res.status).toBe(200);
      expect(toolResult(body).isError).toBe(true);
    });

    it("searchChats fails validation without query (no embedding call)", async () => {
      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const { res, body } = await client.callTool("searchChats", { userId: uniqueTestUserId() }, 26);
      expect(res.status).toBe(200);
      expect(toolResult(body).isError).toBe(true);
    });
  });

  const describeOpenAI = openaiEnabled ? describe : describe.skip;

  describeOpenAI("Tier B: saveChat, searchChats, workflow (OPENAI_API_KEY)", () => {
    it("saveChat persists row and returns chatId", async () => {
      const userId = uniqueTestUserId();
      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const { res, body } = await client.callTool(
        "saveChat",
        {
          userId,
          title: "Portland trip",
          turns: [{ prompt: "food?", response: "food carts." }],
        },
        30,
      );
      expect(res.status).toBe(200);
      const tr = toolResult(body);
      expect(tr.isError).not.toBe(true);
      const sc = tr.structuredContent as { chatId: string };
      expect(typeof sc.chatId).toBe("string");
      expect(sc.chatId.length).toBeGreaterThan(0);

      const rows = await db.select().from(chats).where(eq(chats.id, sc.chatId));
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(userId);
      expect(rows[0].title).toBe("Portland trip");
      expect(rows[0].turns).toEqual([{ prompt: "food?", response: "food carts." }]);
    });

    it("loadChats returns saveChat data", async () => {
      const userId = uniqueTestUserId();
      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const { body: saveBody } = await client.callTool(
        "saveChat",
        {
          userId,
          title: "List me",
          turns: [{ prompt: "x", response: "y" }],
        },
        31,
      );
      const chatId = (toolResult(saveBody).structuredContent as { chatId: string }).chatId;
      expect(chatId).toBeDefined();

      const { body: loadBody } = await client.callTool("loadChats", { userId, page: 1, limit: 10 }, 32);
      const sc = toolResult(loadBody).structuredContent as {
        chats: { title: string; turns: unknown }[];
      };
      expect(sc.chats.some((c) => c.title === "List me")).toBe(true);
    });

    it("searchChats returns results for saved chat", async () => {
      const userId = uniqueTestUserId();
      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);
      const distinctive = "chatvault-e2e-search-phrase-unique-xyz";
      await client.callTool(
        "saveChat",
        {
          userId,
          title: "t",
          turns: [{ prompt: `${distinctive} question here`, response: "ok" }],
        },
        33,
      );

      const { body } = await client.callTool(
        "searchChats",
        { userId, query: distinctive, limit: 5 },
        34,
      );
      const tr = toolResult(body);
      expect(tr.isError).not.toBe(true);
      const sc = tr.structuredContent as {
        chats: unknown[];
        search: { query: string; limit: number; resultCount: number; distances: number[] };
      };
      expect(sc.search.query).toBe(distinctive);
      expect(sc.search.limit).toBe(5);
      expect(sc.search.resultCount).toBeGreaterThanOrEqual(1);
      expect(sc.chats.length).toBe(sc.search.resultCount);
      expect(tr._meta).toEqual(tr.structuredContent);
    });

    it("workflow save → load → search", async () => {
      const userId = uniqueTestUserId();
      const client = new McpHttpClient(server.baseUrl);
      await readySession(client);

      const marker = `wf-marker-${Date.now()}`;
      await client.callTool(
        "saveChat",
        {
          userId,
          title: "W1",
          turns: [{ prompt: `${marker} first`, response: "a" }],
        },
        40,
      );
      await client.callTool(
        "saveChat",
        {
          userId,
          title: "W2",
          turns: [{ prompt: "other second chat", response: "b" }],
        },
        41,
      );

      const { body: loadBody } = await client.callTool("loadChats", { userId, page: 1, limit: 10 }, 42);
      const loadSc = toolResult(loadBody).structuredContent as { chats: unknown[]; pagination: { total: number } };
      expect(loadSc.pagination.total).toBe(2);
      expect(loadSc.chats).toHaveLength(2);

      const { body: searchBody } = await client.callTool("searchChats", { userId, query: marker, limit: 10 }, 43);
      const searchTr = toolResult(searchBody);
      expect(searchTr.isError).not.toBe(true);
      const searchSc = searchTr.structuredContent as {
        chats: unknown[];
        search: { resultCount: number };
      };
      expect(searchSc.search.resultCount).toBe(searchSc.chats.length);
      expect(searchSc.search.resultCount).toBeGreaterThanOrEqual(1);
    });
  });
});
