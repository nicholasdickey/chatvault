import { and, eq, isNotNull, sql } from "drizzle-orm";

import type { AppDatabase } from "@/db";
import { chats, type ChatTurn } from "@/db/schema";

/**
 * pgvector cosine *distance* for `vector` columns (`<=>`).
 * Lower values are more similar; 0 = same direction.
 */
export type SearchMyChatsHit = {
  chat: {
    title: string;
    timestamp: string;
    turns: ChatTurn[];
  };
  /** Cosine distance from pgvector (`embedding <=> query_embedding`). */
  cosineDistance: number;
};

/** Build a PostgreSQL `vector` literal from an embedding (numeric only; from OpenAI). */
function vectorLiteral(embedding: number[]): string {
  return `[${embedding.map((n) => Number(n)).join(",")}]`;
}

/**
 * Vector similarity search: same `userId`, rows with non-null embeddings only,
 * ordered by cosine distance ascending (most similar first).
 */
export async function searchChatsByEmbedding(
  db: AppDatabase,
  userId: string,
  embedding: number[],
  limit: number,
): Promise<SearchMyChatsHit[]> {
  const vecLiteral = vectorLiteral(embedding);
  const queryVec = sql.raw(`'${vecLiteral}'::vector`);

  const rows = await db
    .select({
      title: chats.title,
      timestamp: chats.timestamp,
      turns: chats.turns,
      cosineDistance: sql<string>`(${chats.embedding} <=> ${queryVec})`,
    })
    .from(chats)
    .where(and(eq(chats.userId, userId), isNotNull(chats.embedding)))
    .orderBy(sql`${chats.embedding} <=> ${queryVec}`)
    .limit(limit);

  return rows.map((r) => ({
    chat: {
      title: r.title,
      timestamp:
        r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
      turns: r.turns,
    },
    cosineDistance: Number(r.cosineDistance),
  }));
}
