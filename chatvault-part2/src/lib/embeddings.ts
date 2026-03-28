import OpenAI from "openai";

import { EMBEDDING_DIMENSIONS } from "@/db/schema";

const DEFAULT_MODEL = "text-embedding-3-small";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

/**
 * Creates a vector embedding for the given text using the OpenAI Embeddings API.
 */
export async function embedText(text: string): Promise<number[]> {
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_MODEL;
  const inputLength = text.length;
  console.info("[mcp]", "embed_request", { model, inputLength });

  const client = getClient();
  const res = await client.embeddings.create({
    model,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const embedding = res.data[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding length: got ${embedding?.length ?? 0}, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }
  console.info("[mcp]", "embed_ok", { model, inputLength, dim: embedding.length });
  return embedding;
}
