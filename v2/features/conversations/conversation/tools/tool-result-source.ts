'use client';

import { createContext, useContext } from 'react';

import { chatApi } from '@/lib/api/chat';
import type { ApiMessage } from '@/types/chat';

/**
 * Where a step's result is fetched when the chat's download left it out
 * (use-tool-result.ts). The owner's chat page reads its own route, for the
 * chat its chat context names. The admin conversation view has no chat
 * context (nothing in it may send), so it names its chat here and reads the
 * admin route, which gives a result cut at 200 kB in full (Backend aee2efb0;
 * Stay, thread 085a980c: "like for like").
 */
export interface ToolResultSource {
  /** The chat whose steps these are, where no chat context names it; `null` to use the chat context's. */
  conversationId: string | null;
  read: (conversationId: string, messageId: number) => Promise<{ success: boolean; message?: string; data: ApiMessage | null }>;
}

export const OWNER_TOOL_RESULTS: ToolResultSource = {
  conversationId: null,
  read: chatApi.getToolResult,
};

const ToolResultSourceContext = createContext<ToolResultSource>(OWNER_TOOL_RESULTS);

export const ToolResultSourceProvider = ToolResultSourceContext.Provider;

export function useToolResultSource(): ToolResultSource {
  return useContext(ToolResultSourceContext);
}
