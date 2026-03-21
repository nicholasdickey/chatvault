import http from "node:http";
import {
  handleNodeMcpDelete,
  handleNodeMcpGet,
  handleNodeMcpPost,
} from "./mcp-http.js";

const PORT = Number(process.env.PORT ?? 3000);

function mcpPath(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.split("?")[0];
}

const server = http.createServer((req, res) => {
  const pathOnly = mcpPath(req.url);
  if (pathOnly !== "/mcp") {
    if (req.method === "GET" && pathOnly === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  if (req.method === "GET") {
    void handleNodeMcpGet(req, res);
    return;
  }
  if (req.method === "DELETE") {
    void handleNodeMcpDelete(req, res);
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, {
      Allow: "GET, POST, DELETE",
      "Content-Type": "text/plain",
    });
    res.end("Method Not Allowed");
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => {
    chunks.push(chunk);
  });
  req.on("end", () => {
    void (async () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let parsed: unknown;
      try {
        parsed = raw.trim() === "" ? null : JSON.parse(raw);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
            id: null,
          }),
        );
        return;
      }
      await handleNodeMcpPost(req, res, parsed);
    })();
  });
});

server.listen(PORT, () => {
  console.log(
    `[chatvault-part1] MCP Streamable HTTP at http://127.0.0.1:${PORT}/mcp (GET /health)`,
  );
});
