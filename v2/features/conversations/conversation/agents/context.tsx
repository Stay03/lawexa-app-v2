'use client';

import { createContext, useContext, useMemo } from 'react';

import type { AgentChain, AgentChainEntry } from '@/types/agent-chain';
import { chainRowsByMessage, type ChainNode } from './agent-chain';

interface AgentChainValue {
  /** The chat the chain hangs from: read again when an agent's streamed turn ends. */
  conversationId: string;
  /** Null until read, and for a chat with no agents (confidential, refused). */
  chain: AgentChain | null;
}

const AgentChainContext = createContext<AgentChainValue | null>(null);

/**
 * The open chat's agent chain (chain view, thread 694678cf), read once for the
 * page: the rows after each turn that called an agent, the rows inside an
 * agent's side panel for the agents it called, the panel's own state, and the
 * held marks. The screen provides it from the controller's read; the side
 * panel renders inside it.
 */
export function AgentChainProvider({
  conversationId,
  chain,
  children,
}: {
  conversationId: string;
  chain: AgentChain | null;
  children: React.ReactNode;
}) {
  const value = useMemo<AgentChainValue>(() => ({ conversationId, chain }), [conversationId, chain]);
  return <AgentChainContext.Provider value={value}>{children}</AgentChainContext.Provider>;
}

/** Who a set of rows hangs from: the chat (depth 0, "Lawexa") or an agent in its side panel. */
export interface ChainParent {
  id: string;
  depth: number;
  name: string;
}

/**
 * The rows of the agents a turn called, nested, and the chat they hang from;
 * null when the turn called none. `parent` is the conversation the turn is in:
 * the chat itself unless given (an agent's side panel).
 */
export function useAgentRowsOf(
  messageId: number | null,
  parent?: ChainParent,
): { conversationId: string; rows: readonly ChainNode[] } | null {
  const value = useContext(AgentChainContext);
  const chain = value?.chain ?? null;
  const parentId = parent?.id ?? value?.conversationId ?? null;
  const parentDepth = parent?.depth ?? 0;
  const parentName = parent?.name ?? 'Lawexa';
  const byMessage = useMemo(
    () => (chain && parentId ? chainRowsByMessage(chain, parentId, { parentDepth, parentName }) : null),
    [chain, parentId, parentDepth, parentName],
  );
  if (!value || messageId === null || !byMessage) return null;
  const rows = byMessage.get(messageId);
  return rows ? { conversationId: value.conversationId, rows } : null;
}

/** One agent of the chain by its conversation's uuid (the side panel's own state); null when it is not in it. */
export function useChainEntry(agentConversationId: string): AgentChainEntry | null {
  const value = useContext(AgentChainContext);
  return value?.chain?.agents.find((entry) => entry.id === agentConversationId) ?? null;
}

/** The reply messages the chain's rows already show, so a reply line under them does not repeat their start. */
export function useRosterReplyIds(): ReadonlySet<number> {
  const value = useContext(AgentChainContext);
  const chain = value?.chain ?? null;
  return useMemo(() => {
    const ids = new Set<number>();
    for (const entry of chain?.agents ?? []) {
      const reply = entry.state === 'replied' ? entry.latest_call?.reply : null;
      if (reply) ids.add(reply.message_id);
    }
    return ids;
  }, [chain]);
}

/**
 * The chain's open state, its held messages and its newest calling turn, for
 * Lawexa's line over the deck ("… · 1 message queued") and its Stop. Empty
 * outside a chat with a chain.
 */
export function useChainHeld(): { open: boolean; heldIds: readonly number[]; newestCaller: number | null } {
  const value = useContext(AgentChainContext);
  const chain = value?.chain ?? null;
  return useMemo(() => {
    // The chat's newest turn that asked agents: Lawexa's line, with the chain's Stop, sits on its deck alone.
    const callers = (chain?.agents ?? [])
      .filter((entry) => entry.depth === 1)
      .map((entry) => entry.latest_call?.called_by_message_id ?? null)
      .filter((id): id is number => id !== null);
    return {
      open: chain?.chain_open === true,
      heldIds: chain?.held_messages.map((held) => held.id) ?? [],
      newestCaller: callers.length ? Math.max(...callers) : null,
    };
  }, [chain]);
}
