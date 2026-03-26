import { pool } from "./client.js";
import type { ChatTurn } from "./schema.js";

export type SearchChatRow = {
  title: string;
  timestamp: Date;
  turns: ChatTurn[];
  /** Cosine distance from pgvector (`<=>`); lower is more similar. */
  distance: number;
};

/**
 * Vector similarity search: same userId, cosine distance ascending (most similar first).
 */
export async function searchChatsByEmbedding(
  userId: string,
  embedding: number[],
  limit: number,
): Promise<SearchChatRow[]> {
  const vectorLiteral = `[${embedding.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;

  const result = await pool.query<{
    title: string;
    timestamp: Date;
    turns: unknown;
    distance: string;
  }>(
    `SELECT title, timestamp, turns,
            (embedding <=> $1::vector) AS distance
     FROM chats
     WHERE user_id = $2
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector ASC
     LIMIT $3`,
    [vectorLiteral, userId, limit],
  );

  return result.rows.map((row) => ({
    title: row.title,
    timestamp: row.timestamp,
    turns: row.turns as ChatTurn[],
    distance: Number(row.distance),
  }));
}
