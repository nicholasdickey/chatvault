import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getMcpPublicOrigin } from "./mcp-public-url.js";

/** Canonical widget resource URI. */
export const WIDGET_RESOURCE_URI = "ui://chat-vault/mcp-app.html";

export const MCP_SERVER_INFO = {
  name: "chatvault-part1",
  version: "0.0.1",
} as const;

const packageRoot = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");

const WIDGET_MISSING_SNIPPET = "Widget bundle missing";

async function readWidgetHtml(): Promise<string> {
  const candidates = [
    path.join(packageRoot, "assets", "mcp-app.html"),
    path.join(process.cwd(), "assets", "mcp-app.html"),
  ];
  for (const filePath of candidates) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      /* try next */
    }
  }
  return `<!doctype html><html><body><p>${WIDGET_MISSING_SNIPPET}; run <code>pnpm build</code>.</p></body></html>`;
}

/** Used by `GET /mcp` — server identity and whether the built widget HTML is on disk. */
export async function getMcpDeploymentHealth(): Promise<{
  ok: boolean;
  server: { name: string; version: string };
  widget: { ok: boolean; bytes: number };
}> {
  const html = await readWidgetHtml();
  const widgetOk = !html.includes(WIDGET_MISSING_SNIPPET);
  return {
    ok: widgetOk,
    server: { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version },
    widget: {
      ok: widgetOk,
      bytes: Buffer.byteLength(html, "utf8"),
    },
  };
}

/** `_meta` for `resources/read` content item: ext-apps `ui` + OpenAI host hints (Prompt 5). */
function buildWidgetResourceContentMeta(publicOrigin: string): Record<string, unknown> {
  const host = new URL(publicOrigin).host;
  const origins = [publicOrigin];

  return {
    ui: {
      prefersBorder: true,
      domain: host,
      csp: {
        connectDomains: [...origins],
        resourceDomains: [...origins],
      },
    },
    "openai/outputTemplate": WIDGET_RESOURCE_URI,
    "openai/widgetPrefersBorder": true,
    "openai/widgetDomain": publicOrigin,
    "openai/widgetCSP": {
      connect_domains: origins,
      resource_domains: origins,
    },
  };
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version },
    { capabilities: { logging: {} } },
  );

  registerAppTool(
    server,
    "testWidget",
    {
      description: "Open the MCP App test widget (tutorial scaffold).",
      inputSchema: {
        shortAnonId: z.string().optional(),
        portalLink: z.string().url().optional(),
        loginLink: z.string().url().optional(),
        isAnon: z.boolean().optional(),
      },
      _meta: {
        ui: { resourceUri: WIDGET_RESOURCE_URI },
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: "testWidget: MCP App UI resource is available. Open the widget in a supported host to verify.",
          },
        ],
        _meta: {
          ui: { resourceUri: WIDGET_RESOURCE_URI },
        },
      };
    },
  );

  registerAppResource(
    server as unknown as Parameters<typeof registerAppResource>[0],
    "ChatVault widget",
    WIDGET_RESOURCE_URI,
    { description: "MCP App single-file HTML widget (tutorial)" },
    async () => {
      const html = await readWidgetHtml();
      const publicOrigin = getMcpPublicOrigin();
      console.log(
        `[mcp] resources/read widget uri=${WIDGET_RESOURCE_URI} bytes=${Buffer.byteLength(html, "utf8")} origin=${publicOrigin}`,
      );
      return {
        contents: [
          {
            uri: WIDGET_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: buildWidgetResourceContentMeta(publicOrigin),
          },
        ],
      };
    },
  );

  return server;
}
