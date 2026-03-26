import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "../../db/client.js";
import { chats, type ChatTurn } from "../../db/schema.js";
import { combineTurnsForEmbedding, embedText } from "../../embeddings/openai.js";

const log = (msg: string, extra?: Record<string, unknown>) => {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[chatvault-part2][saveChat] ${msg}`, extra);
  } else {
    console.log(`[chatvault-part2][saveChat] ${msg}`);
  }
};

export function registerSaveChatTool(server: McpServer): void {
  server.registerTool(
    "saveChat",
    {
      description:
        "Save a chat for a user: stores title and conversation turns, and embeds the full chat text for later search.",
      inputSchema: {
        userId: z.string().min(1, "userId is required"),
        title: z.string(),
        turns: z
          .array(
            z.object({
              prompt: z.string(),
              response: z.string(),
            }),
          )
          .min(1, "at least one turn is required"),
      },
    },
    async (args) => {
      try {
        const { userId, title, turns } = args;

        log("dispatch", {
          userId,
          titleLength: title.length,
          turnCount: turns.length,
        });

        const text = combineTurnsForEmbedding(turns as ChatTurn[]);
        log("embedding_request", { charLength: text.length });
        const embedding = await embedText(text);
        log("embedding_ok", { dimensions: embedding.length });

        const [row] = await db
          .insert(chats)
          .values({
            userId,
            title,
            turns: turns as ChatTurn[],
            embedding,
          })
          .returning({ id: chats.id });

        if (!row) {
          throw new McpError(ErrorCode.InternalError, "Failed to insert chat row");
        }

        log("insert_ok", { chatId: row.id });

        return {
          content: [
            {
              type: "text" as const,
              text: `Saved chat ${row.id}.`,
            },
          ],
          structuredContent: {
            chatId: row.id,
          },
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
