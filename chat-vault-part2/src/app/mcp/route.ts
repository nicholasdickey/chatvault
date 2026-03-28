/**
 * MCP HTTP endpoint (Prompt2 scaffold). JSON-RPC MCP handling is implemented in Prompt4.
 */
export async function POST() {
  return Response.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message:
          "MCP handler not implemented yet; complete Prompt4 (basic MCP HTTP streaming server).",
      },
    },
    { status: 501, headers: { "Content-Type": "application/json" } },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
      "Access-Control-Max-Age": "86400",
    },
  });
}
