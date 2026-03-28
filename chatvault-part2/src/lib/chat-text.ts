import type { ChatTurn } from "@/db/schema";

/**
 * Builds a single string from the full chat for embedding (all prompts + responses).
 * Title is included to improve semantic coverage; turns are required content per Prompt6.
 */
export function buildEmbeddingInput(title: string, turns: ChatTurn[]): string {
  const lines: string[] = [`Title: ${title}`];
  for (const t of turns) {
    lines.push("", `User: ${t.prompt}`, `Assistant: ${t.response}`);
  }
  return lines.join("\n");
}
