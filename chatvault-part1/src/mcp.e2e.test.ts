import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WIDGET_RESOURCE_URI } from "./create-mcp-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      s.close(() => {
        if (addr && typeof addr !== "string") {
          resolve(addr.port);
        } else {
          reject(new Error("Could not allocate port"));
        }
      });
    });
    s.on("error", reject);
  });
}

async function waitForHealth(port: number, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) {
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Health check timed out for port ${port}`);
}

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
} as const;

describe("MCP Streamable HTTP (e2e)", () => {
  let port: number;
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    execSync("pnpm run build", {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
    });
    port = await getFreePort();
    child = spawn("pnpm", ["exec", "tsx", "src/dev-server.ts"], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stderr?.on("data", (d: Buffer) => {
      process.stderr.write(d);
    });
    await new Promise<void>((resolve, reject) => {
      child!.once("error", reject);
      const onEarlyExit = (code: number | null, signal: NodeJS.Signals | null) => {
        reject(
          new Error(
            `dev-server exited before ready: code=${code} signal=${signal ?? ""}`,
          ),
        );
      };
      child!.once("exit", onEarlyExit);
      waitForHealth(port)
        .then(() => {
          child!.removeListener("exit", onEarlyExit);
          resolve();
        })
        .catch(reject);
    });
  }, 120000);

  afterAll(() => {
    child?.kill("SIGTERM");
    child = undefined;
  });

  it("runs initialize, tools/list, resources/list, resources/read, tools/call testWidget", async () => {
    const base = `http://127.0.0.1:${port}/mcp`;

    const getRes = await fetch(base, { method: "GET" });
    expect(getRes.status).toBe(200);
    const health = (await getRes.json()) as {
      ok: boolean;
      server: { name: string };
      widget: { ok: boolean; bytes: number };
    };
    expect(health.ok).toBe(true);
    expect(health.server.name).toBe("chatvault-part1");
    expect(health.widget.ok).toBe(true);
    expect(health.widget.bytes).toBeGreaterThan(50_000);

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
      result?: { protocolVersion?: string };
      error?: unknown;
    };
    expect(initJson.jsonrpc).toBe("2.0");
    expect(initJson.error).toBeUndefined();
    expect(initJson.result).toBeDefined();

    const protocolVersion =
      initJson.result?.protocolVersion ?? "2025-03-26";

    const sessionHeaders = {
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
    expect(initNotify.status).toBe(202);

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
      result?: { tools?: { name: string }[] };
      error?: unknown;
    };
    expect(toolsJson.error).toBeUndefined();
    const toolNames = toolsJson.result?.tools?.map((t) => t.name) ?? [];
    expect(toolNames).toContain("testWidget");

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
    const resListJson = (await resourcesList.json()) as {
      result?: { resources?: { uri: string }[] };
      error?: unknown;
    };
    expect(resListJson.error).toBeUndefined();
    expect(
      resListJson.result?.resources?.some((r) => r.uri === WIDGET_RESOURCE_URI),
    ).toBe(true);

    const resourcesRead = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "resources/read",
        params: { uri: WIDGET_RESOURCE_URI },
      }),
    });
    expect(resourcesRead.status).toBe(200);
    const readJson = (await resourcesRead.json()) as {
      result?: {
        contents?: {
          text?: string;
          _meta?: Record<string, unknown>;
        }[];
      };
      error?: unknown;
    };
    expect(readJson.error).toBeUndefined();
    const content0 = readJson.result?.contents?.[0];
    const text = content0?.text ?? "";
    expect(text.length).toBeGreaterThan(50_000);
    expect(text.toLowerCase()).toContain("<script");
    const meta = content0?._meta;
    expect(meta).toBeDefined();
    expect(meta?.["openai/outputTemplate"]).toBe(WIDGET_RESOURCE_URI);
    expect(meta?.["openai/widgetPrefersBorder"]).toBe(true);
    expect(typeof meta?.["openai/widgetDomain"]).toBe("string");
    expect(meta?.["openai/widgetCSP"]).toBeDefined();

    const testWidgetCall = await fetch(base, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "testWidget",
          arguments: {},
        },
      }),
    });
    expect(testWidgetCall.status).toBe(200);
    const twJson = (await testWidgetCall.json()) as {
      result?: {
        content?: { type: string; text?: string }[];
        _meta?: { ui?: { resourceUri?: string } };
      };
      error?: unknown;
    };
    expect(twJson.error).toBeUndefined();
    expect(twJson.result?.content?.[0]?.type).toBe("text");
    expect(twJson.result?.content?.[0]?.text).toContain("testWidget");
    expect(twJson.result?._meta?.ui?.resourceUri).toBe(WIDGET_RESOURCE_URI);
  });
});
