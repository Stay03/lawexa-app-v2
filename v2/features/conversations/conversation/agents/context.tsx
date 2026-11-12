'use client';

import { createContext, useContext, useMemo } from 'react';

import type { AgentConversation } from '@/types/agent-conversations';
import { agentRowsByMessage, type AgentRow } from './agent-roster';

interface AgentRowsValue {
  /** The chat the agents were called in: its list is read again when an agent's turn ends. */
  conversationId: string;
  byMessage: ReadonlyMap<number, readonly AgentRow[]>;
}

const AgentRowsContext = createContext<AgentRowsValue | null>(null);

/**
 * The open chat's agents, for the rows after each turn that called one (C1).
 * The screen provides them from the controller's read; the roster deep in the
 * transcript finds a turn's rows by its question's saved id.
 */
export function AgentRowsProvider({
  conversationId,
  agentConversations,
  children,
}: {
  conversationId: string;
  agentConversations: readonly AgentConversation[];
  children: React.ReactNode;
}) {
  const value = useMemo<AgentRowsValue>(
    () => ({ conversationId, byMessage: agentRowsByMessage(agentConversations) }),
    [conversationId, agentConversations],
  );
  return <AgentRowsContext.Provider value={value}>{children}</AgentRowsContext.Provider>;
}

/** The rows of the agents a question's turn called, and its chat; null when it called none. */
export function useAgentRowsOf(messageId: number | null): { conversationId: string; rows: readonly AgentRow[] } | null {
  const value = useContext(AgentRowsContext);
  if (!value || messageId === null) return null;
  const rows = value.byMessage.get(messageId);
  return rows ? { conversationId: value.conversationId, rows } : null;
}
