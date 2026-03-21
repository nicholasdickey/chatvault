import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  handleNodeMcpDelete,
  handleNodeMcpGet,
  handleNodeMcpPost,
} from "../src/mcp-http.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRequestBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method === "GET") {
    await handleNodeMcpGet(req, res);
    return;
  }
  if (req.method === "DELETE") {
    await handleNodeMcpDelete(req, res);
    return;
  }
  if (req.method !== "POST") {
    res
      .status(405)
      .setHeader("Allow", "GET, POST, DELETE")
      .send("Method Not Allowed");
    return;
  }

  const raw = await readRequestBody(req);
  let parsed: unknown;
  try {
    parsed = raw.trim() === "" ? null : JSON.parse(raw);
  } catch (e) {
    console.warn("[mcp] JSON parse error on POST /mcp", e);
    res.status(400).setHeader("Content-Type", "application/json").send(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error" },
        id: null,
      }),
    );
    return;
  }

  await handleNodeMcpPost(req, res, parsed);
}
