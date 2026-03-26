import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

/**
 * Minimal Streamable HTTP MCP client: persists `mcp-session-id` from responses.
 */
export class McpHttpClient {
  private sessionId: string | null = null;

  /** Set after successful initialize (required on subsequent Streamable HTTP requests). */
  private negotiatedProtocolVersion: string | null = null;

  constructor(private readonly baseUrl: string) {}

  private mcpUrl(): string {
    return `${this.baseUrl.replace(/\/$/, "")}/mcp`;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  clearSession(): void {
    this.sessionId = null;
    this.negotiatedProtocolVersion = null;
  }

  async post(body: JsonRpcRequest | Record<string, unknown>): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // Streamable HTTP spec: client must accept both JSON and SSE (SDK validates even when using JSON-only responses).
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
      headers["Mcp-Protocol-Version"] =
        this.negotiatedProtocolVersion ?? LATEST_PROTOCOL_VERSION;
    }
    const res = await fetch(this.mcpUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const sid = res.headers.get("mcp-session-id");
    if (sid) {
      this.sessionId = sid;
    }
    return res;
  }

  async initialize(requestId: string | number = 1): Promise<{ res: Response; body: unknown }> {
    const res = await this.post({
      jsonrpc: "2.0",
      id: requestId,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "chatvault-jest", version: "0.0.1" },
      },
    });
    const body = res.status === 204 ? null : await res.json();
    const pv = (body as { result?: { protocolVersion?: string } } | null)?.result?.protocolVersion;
    if (pv) {
      this.negotiatedProtocolVersion = pv;
    }
    return { res, body };
  }

  async sendInitializedNotification(): Promise<Response> {
    return this.post({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
  }

  async toolsList(requestId: string | number = 2): Promise<{ res: Response; body: unknown }> {
    const res = await this.post({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/list",
      params: {},
    });
    const text = await res.text();
    const body = res.status === 204 || text === "" ? null : (JSON.parse(text) as unknown);
    return { res, body };
  }

  async resourcesList(requestId: string | number = 3): Promise<{ res: Response; body: unknown }> {
    const res = await this.post({
      jsonrpc: "2.0",
      id: requestId,
      method: "resources/list",
      params: {},
    });
    const text = await res.text();
    const body = res.status === 204 || text === "" ? null : (JSON.parse(text) as unknown);
    return { res, body };
  }

  /**
   * JSON-RPC `tools/call` (MCP `CallToolRequest`).
   */
  async callTool(
    name: string,
    arguments_: Record<string, unknown>,
    requestId: string | number = 10,
  ): Promise<{ res: Response; body: unknown }> {
    const res = await this.post({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: { name, arguments: arguments_ },
    });
    const text = await res.text();
    const body = res.status === 204 || text === "" ? null : (JSON.parse(text) as unknown);
    return { res, body };
  }
}
