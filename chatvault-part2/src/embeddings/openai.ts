import { EMBEDDING_DIMENSIONS, type ChatTurn } from "../db/schema.js";

const DEFAULT_MODEL = "text-embedding-3-small";

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

export function embeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Single string over the whole conversation for embedding (Prompt6: all prompts + responses).
 */
export function combineTurnsForEmbedding(turns: ChatTurn[]): string {
  return turns
    .map(
      (t, i) =>
        `Turn ${i + 1}\nPrompt:\n${t.prompt}\n\nResponse:\n${t.response}`,
    )
    .join("\n\n---\n\n");
}

type OpenAIEmbeddingsResponse = {
  data?: Array<{ embedding: number[] }>;
  error?: { message?: string };
};

/**
 * Calls OpenAI Embeddings API; returns a vector of length {@link EMBEDDING_DIMENSIONS}.
 */
export async function embedText(input: string): Promise<number[]> {
  const apiKey = requireApiKey();
  const model = embeddingModel();

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  const raw = (await res.json()) as OpenAIEmbeddingsResponse;
  if (!res.ok) {
    const msg = raw.error?.message ?? res.statusText ?? "OpenAI embeddings request failed";
    throw new Error(`OpenAI embeddings failed (${res.status}): ${msg}`);
  }

  const embedding = raw.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("OpenAI embeddings response missing embedding vector");
  }
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: got ${embedding.length}, expected ${EMBEDDING_DIMENSIONS} for model ${model}`,
    );
  }
  return embedding;
}
