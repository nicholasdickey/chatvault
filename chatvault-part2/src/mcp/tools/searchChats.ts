import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { searchChatsByEmbedding } from "../../db/searchChats.js";
import { embedText, embeddingModel } from "../../embeddings/openai.js";
import type { ChatListItem } from "./loadChats.js";

const log = (msg: string, extra?: Record<string, unknown>) => {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[chatvault-part2][searchChats] ${msg}`, extra);
  } else {
    console.log(`[chatvault-part2][searchChats] ${msg}`);
  }
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export function registerSearchChatsTool(server: McpServer): void {
  server.registerTool(
    "searchChats",
    {
      description:
        "Semantic search over saved chats for a user using embeddings (most similar first).",
      inputSchema: {
        userId: z.string().min(1, "userId is required"),
        query: z.string().min(1, "query is required"),
        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .default(DEFAULT_LIMIT),
      },
    },
    async (args) => {
      try {
        const userId = args.userId;
        const query = args.query;
        const limit = args.limit ?? DEFAULT_LIMIT;

        log("dispatch", {
          userId,
          queryLength: query.length,
          limit,
        });

        const queryEmbedding = await embedText(query);
        log("embedding_ok", {
          dimensions: queryEmbedding.length,
          model: embeddingModel(),
        });

        const rows = await searchChatsByEmbedding(userId, queryEmbedding, limit);

        const chats: ChatListItem[] = rows.map((row) => ({
          title: row.title,
          timestamp:
            row.timestamp instanceof Date
              ? row.timestamp.toISOString()
              : String(row.timestamp),
          turns: row.turns,
        }));

        const distances = rows.map((r) => r.distance);

        const payload = {
          chats,
          search: {
            query,
            limit,
            resultCount: chats.length,
            distances,
          },
        };

        log("ok", {
          userId,
          resultCount: chats.length,
          limit,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                chats.length === 0
                  ? "No matching chats found."
                  : `Found ${chats.length} chat(s) ranked by similarity.`,
            },
          ],
          structuredContent: payload,
          _meta: payload,
        };
      } catch (err) {
        if (err instanceof McpError) {
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        log("error", { message });
        throw new McpError(ErrorCode.InternalError, message);
      }
    },
  );
}
