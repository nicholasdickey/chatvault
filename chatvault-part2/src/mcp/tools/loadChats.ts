import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { chats, type ChatTurn } from "../../db/schema.js";

const log = (msg: string, extra?: Record<string, unknown>) => {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[chatvault-part2][loadChats] ${msg}`, extra);
  } else {
    console.log(`[chatvault-part2][loadChats] ${msg}`);
  }
};

/** Part 1 `Chat` shape (title, timestamp ISO string, turns). */
export type ChatListItem = {
  title: string;
  timestamp: string;
  turns: ChatTurn[];
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export type LoadChatsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

function toPagination(
  page: number,
  limit: number,
  total: number,
): LoadChatsPagination {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const hasMore = page * limit < total;
  return { page, limit, total, totalPages, hasMore };
}

export function registerLoadChatsTool(server: McpServer): void {
  server.registerTool(
    "loadChats",
    {
      description:
        "List saved chats for a user with pagination (newest first). Returns chats and pagination metadata.",
      inputSchema: {
        userId: z.string().min(1, "userId is required"),
        page: z.coerce.number().int().min(1).optional().default(DEFAULT_PAGE),
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
        const page = args.page ?? DEFAULT_PAGE;
        const limit = args.limit ?? DEFAULT_LIMIT;
        const offset = (page - 1) * limit;

        log("dispatch", { userId, page, limit, offset });

        const [countRow] = await db
          .select({ total: count() })
          .from(chats)
          .where(eq(chats.userId, userId));

        const total = Number(countRow?.total ?? 0);

        const rows = await db
          .select({
            title: chats.title,
            timestamp: chats.timestamp,
            turns: chats.turns,
          })
          .from(chats)
          .where(eq(chats.userId, userId))
          .orderBy(desc(chats.timestamp), desc(chats.id))
          .limit(limit)
          .offset(offset);

        const chatsOut: ChatListItem[] = rows.map((row) => ({
          title: row.title,
          timestamp:
            row.timestamp instanceof Date
              ? row.timestamp.toISOString()
              : String(row.timestamp),
          turns: row.turns as ChatTurn[],
        }));

        const pagination = toPagination(page, limit, total);

        log("ok", {
          userId,
          page,
          limit,
          returned: chatsOut.length,
          total,
        });

        const payload = { chats: chatsOut, pagination };

        return {
          content: [
            {
              type: "text" as const,
              text: `Loaded ${chatsOut.length} chat(s) (page ${page} of ${pagination.totalPages || 1}, ${total} total).`,
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
