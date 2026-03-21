/** One turn in a saved chat (Prompt 7). */
export type ChatTurn = { prompt: string; response: string };

/** Saved chat row for ChatVault lists. */
export type Chat = {
  title: string;
  timestamp: string;
  turns: ChatTurn[];
};

/** Context from `browseMySavedChats` passed to the widget via tool args + `_meta.chatVault`. */
export type ChatVaultBrowseContext = {
  shortAnonId?: string;
  portalLink?: string;
  loginLink?: string;
  isAnon?: boolean;
};

/** `structuredContent` shape for `tools/call` → `loadMyChats`. */
export type LoadMyChatsStructuredContent = {
  chats: Chat[];
  nextCursor: string | null;
};
