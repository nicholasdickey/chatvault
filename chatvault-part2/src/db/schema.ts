import { jsonb, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

/** Matches Part 1 `ChatTurn` (see chatvault-part1 `chatvault-types.ts`). */
export type ChatTurn = { prompt: string; response: string };

/** OpenAI `text-embedding-3-small` default output size; keep in sync with `OPENAI_EMBEDDING_MODEL`. */
export const EMBEDDING_DIMENSIONS = 1536 as const;

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  turns: jsonb("turns").$type<ChatTurn[]>().notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
});
