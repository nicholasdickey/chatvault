import http from "node:http";

const PORT = Number(process.env.PORT ?? 3000);

function mcpPath(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.split("?")[0];
}

const placeholderBody = JSON.stringify({
  message: "MCP HTTP handler not implemented yet (Prompt 3).",
});

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

  if (req.method === "GET" || req.method === "DELETE") {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(placeholderBody);
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, {
      Allow: "GET, POST, DELETE",
      "Content-Type": "application/json",
    });
    res.end(placeholderBody);
    return;
  }

  res.writeHead(501, { "Content-Type": "application/json" });
  res.end(placeholderBody);
});

server.listen(PORT, () => {
  console.log(
    `[chatvault-part1] Placeholder MCP at http://127.0.0.1:${PORT}/mcp (GET /health)`,
  );
});
