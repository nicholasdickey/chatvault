import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: {
    bodyParser: false,
  },
};

const placeholderBody = JSON.stringify({
  message: "MCP HTTP handler not implemented yet (Prompt 3).",
});

export default function handler(
  req: VercelRequest,
  res: VercelResponse,
): void {
  if (req.method === "GET" || req.method === "DELETE") {
    res.status(501).setHeader("Content-Type", "application/json").send(placeholderBody);
    return;
  }
  if (req.method !== "POST") {
    res
      .status(405)
      .setHeader("Allow", "GET, POST, DELETE")
      .setHeader("Content-Type", "application/json")
      .send(placeholderBody);
    return;
  }

  res.status(501).setHeader("Content-Type", "application/json").send(placeholderBody);
}
