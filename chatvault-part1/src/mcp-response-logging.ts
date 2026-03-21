import type { ServerResponse } from "node:http";

export type McpResponseLogOptions = {
  /** Correlate with `[mcp] jsonrpc-in` / `tools/call` when present. */
  sessionId?: string;
};

function formatSessionSuffix(sessionId: string | undefined): string {
  if (sessionId === undefined || sessionId.length === 0) {
    return "";
  }
  const short =
    sessionId.length > 12 ? `${sessionId.slice(0, 8)}…` : sessionId;
  return ` session=${short}`;
}

/**
 * Wraps `ServerResponse` to log outgoing body size and JSON-RPC outcome after `end`.
 * Safe to call once per response.
 */
export function instrumentMcpResponseLogging(
  res: ServerResponse,
  opts?: McpResponseLogOptions,
): void {
  const chunks: Buffer[] = [];
  let capturedStatus = 0;

  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = function (...args: unknown[]) {
    const first = args[0];
    if (typeof first === "number") {
      capturedStatus = first;
    }
    return (origWriteHead as (...a: unknown[]) => ServerResponse)(...args);
  };

  const origWrite = res.write.bind(res);
  res.write = function (chunk: unknown, ...rest: unknown[]) {
    if (chunk !== undefined && chunk !== null && chunk !== "") {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      }
    }
    return (origWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
  };

  const origEnd = res.end.bind(res);
  res.end = function (chunk?: unknown, ...rest: unknown[]) {
    if (chunk !== undefined && chunk !== null && chunk !== "") {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      }
    }
    const body = Buffer.concat(chunks);
    const len = body.length;
    let outcome = "non-json";
    let rpcId = "(none)";
    try {
      const text = body.toString("utf8").trim();
      if (text.startsWith("{") || text.startsWith("[")) {
        const j = JSON.parse(text) as {
          id?: unknown;
          result?: unknown;
          error?: unknown;
        };
        if (j && typeof j === "object" && !Array.isArray(j)) {
          if ("id" in j) {
            rpcId = JSON.stringify(j.id);
          }
          if ("error" in j && j.error !== undefined) {
            outcome = "error";
          } else if ("result" in j && j.result !== undefined) {
            outcome = "result";
          }
        } else if (Array.isArray(j)) {
          outcome = "batch";
        }
      }
    } catch {
      /* ignore */
    }
    const code = capturedStatus || res.statusCode || 0;
    const sid = formatSessionSuffix(opts?.sessionId);
    console.log(
      `[mcp] response${sid} status=${code} bytes=${len} outcome=${outcome} id=${rpcId}`,
    );
    return (origEnd as (...a: unknown[]) => ServerResponse)(chunk, ...rest);
  };
}
