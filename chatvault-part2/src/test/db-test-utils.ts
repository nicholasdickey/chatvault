import { count, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { chats, EMBEDDING_DIMENSIONS, type ChatTurn } from "@/db/schema";

export type { ChatTurn };

export async function truncateChats(): Promise<void> {
  await getDb().execute(sql`TRUNCATE TABLE chats`);
}

/** Deterministic vector for seeds (no OpenAI). */
export function zeroEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
}

export async function insertChatWithEmbedding(
  userId: string,
  title: string,
  turns: ChatTurn[],
  embedding: number[],
): Promise<string> {
  const [row] = await getDb()
    .insert(chats)
    .values({ userId, title, turns, embedding })
    .returning({ id: chats.id });
  if (!row) {
    throw new Error("insertChatWithEmbedding: insert returned no row");
  }
  return row.id;
}

export async function countChatsForUser(userId: string): Promise<number> {
  const [r] = await getDb()
    .select({ c: count() })
    .from(chats)
    .where(eq(chats.userId, userId));
  return Number(r?.c ?? 0);
}

export async function getChatById(id: string) {
  const [row] = await getDb()
    .select({
      userId: chats.userId,
      title: chats.title,
      turns: chats.turns,
    })
    .from(chats)
    .where(eq(chats.id, id));
  return row;
}
