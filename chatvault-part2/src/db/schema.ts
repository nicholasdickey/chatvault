import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Matches Part 1 `ChatTurn` for JSONB storage and Prompt7 responses. */
export type ChatTurn = { prompt: string; response: string };

/** OpenAI `text-embedding-3-small` at 1536 dimensions (see `src/lib/embeddings.ts`). */
export const EMBEDDING_DIMENSIONS = 1536;

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  turns: jsonb("turns").$type<ChatTurn[]>().notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
});
