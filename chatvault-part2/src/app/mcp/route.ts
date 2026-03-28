import {
  handleMcpDelete,
  handleMcpGet,
  handleMcpOptions,
  handleMcpPost,
} from "@/mcp/handler";

export const runtime = "nodejs";

/**
 * MCP Streamable HTTP (Prompt4). JSON-RPC over POST; session via `mcp-session-id`.
 */
export async function GET(request: Request) {
  return handleMcpGet(request);
}

export async function POST(request: Request) {
  return handleMcpPost(request);
}

export async function DELETE(request: Request) {
  return handleMcpDelete(request);
}

export async function OPTIONS() {
  return handleMcpOptions();
}
