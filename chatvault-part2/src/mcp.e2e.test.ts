import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { initDatabase } from "./db/init.js";
import { closeAllTransports } from "./mcp/httpServer.js";
import type { ChatVaultServer } from "./server.js";
import { startChatVaultServer } from "./server.js";
import { truncateAllUserTables } from "./test/dbTestUtils.js";
import { McpHttpClient } from "./test/mcpHttpClient.js";

describe("MCP HTTP e2e (Prompt5)", () => {
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

  it("initialize handshake returns JSON-RPC 2.0 result", async () => {
    const client = new McpHttpClient(server.baseUrl);
    const { res, body } = await client.initialize(1);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(body).toMatchObject({ jsonrpc: "2.0", id: 1 });
    expect((body as { result?: unknown }).result).toBeDefined();
    expect(client.getSessionId()).toBeTruthy();
  });

  it("notifications/initialized returns 202 or 204 (empty body)", async () => {
    const client = new McpHttpClient(server.baseUrl);
    await client.initialize(1);
    const res = await client.sendInitializedNotification();
    expect([202, 204]).toContain(res.status);
  });

  it("session management: tools/list requires valid session", async () => {
    const client = new McpHttpClient(server.baseUrl);
    const res = await client.post({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { jsonrpc?: string; error?: { code?: number } };
    expect(body.jsonrpc).toBe("2.0");
    expect(body.error).toBeDefined();
  });

  it("session management: tools/list works after initialize (ChatVault tools)", async () => {
    const client = new McpHttpClient(server.baseUrl);
    await client.initialize(1);
    await client.sendInitializedNotification();
    const { res, body } = await client.toolsList(2);
    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: 2,
        result: expect.objectContaining({
          tools: expect.any(Array),
        }),
      }),
    );
    const tools = (body as { result: { tools: { name?: string }[] } }).result.tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["saveChat", "loadChats", "searchChats"]),
    );
  });

  it("JSON-RPC: malformed body returns error response", async () => {
    const res = await fetch(`${server.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: "not-valid-json{",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("resources/list returns empty resources", async () => {
    const client = new McpHttpClient(server.baseUrl);
    await client.initialize(1);
    await client.sendInitializedNotification();
    const { res, body } = await client.resourcesList(3);
    expect(res.status).toBe(200);
    const resources = (body as { result?: { resources?: unknown[] } }).result?.resources;
    expect(Array.isArray(resources)).toBe(true);
    expect(resources).toHaveLength(0);
  });
});
