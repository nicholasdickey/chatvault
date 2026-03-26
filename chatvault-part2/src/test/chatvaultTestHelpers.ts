import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { chats, EMBEDDING_DIMENSIONS, type ChatTurn } from "../db/schema.js";

/** Unique per test for order-independent runs. */
export function uniqueTestUserId(): string {
  return `jest-${randomUUID()}`;
}

/** Deterministic 1536-dim vector: single 1.0 at `index` (rest zeros). */
export function embeddingUnitVector(index: number): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  v[index % EMBEDDING_DIMENSIONS] = 1;
  return v;
}

export async function seedChatRow(opts: {
  userId: string;
  title: string;
  turns: ChatTurn[];
  embedding: number[];
  timestamp?: Date;
}): Promise<void> {
  await db.insert(chats).values({
    userId: opts.userId,
    title: opts.title,
    turns: opts.turns,
    embedding: opts.embedding,
    ...(opts.timestamp !== undefined ? { timestamp: opts.timestamp } : {}),
  });
}

export async function countChatsForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(chats)
    .where(eq(chats.userId, userId));
  return Number(row?.n ?? 0);
}
