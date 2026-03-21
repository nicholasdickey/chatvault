import type { Chat, LoadMyChatsStructuredContent } from "./chatvault-types.js";

const CURSOR_PAGE2 = "p2";

const PAGE1: Chat[] = [
  {
    title: "Weekend trip ideas",
    timestamp: "2025-03-10T14:22:00.000Z",
    turns: [
      {
        prompt: "Suggest a 3-day itinerary for Portland, OR focusing on food and parks.",
        response:
          "Day 1: Washington Park + food carts. Day 2: Powell's + Pearl District dinner. Day 3: Columbia River Gorge day trip.",
      },
      {
        prompt: "Rainy-day backup?",
        response: "OMSI, Portland Art Museum, or a long coffee crawl on Mississippi Ave.",
      },
    ],
  },
  {
    title: "TypeScript module question",
    timestamp: "2025-03-11T09:05:00.000Z",
    turns: [
      {
        prompt: "Why does my Vite app need .js extensions in imports when using NodeNext?",
        response:
          "TypeScript emits the path you write; Node ESM resolution requires explicit extensions matching emitted files.",
      },
    ],
  },
];

const PAGE2: Chat[] = [
  {
    title: "MCP health check notes",
    timestamp: "2025-03-12T18:40:00.000Z",
    turns: [
      {
        prompt: "What should GET /mcp return?",
        response: "JSON with ok, server identity, and widget bundle byte size for quick deploy checks.",
      },
    ],
  },
];

/**
 * Hardcoded paged chats (same data the MCP server uses).
 * Used by the widget when `App.callServerTool` is unavailable (local Vite).
 */
export function loadMyChatsFixture(
  _userId: string,
  cursor?: string | null,
): LoadMyChatsStructuredContent {
  if (cursor === CURSOR_PAGE2) {
    return { chats: PAGE2, nextCursor: null };
  }
  return { chats: PAGE1, nextCursor: CURSOR_PAGE2 };
}

export { CURSOR_PAGE2 };
