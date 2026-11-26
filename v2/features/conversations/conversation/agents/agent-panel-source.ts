'use client';

import { createContext, useContext } from 'react';

import { conversationsQueries } from '../../queries';
import { agentConversationQueries } from './queries';

/**
 * Where the agent panel reads an agent conversation and the agent
 * conversations around it (AgentConversationPanel).
 *
 * The owner's chat reads its own routes. The admin conversation view (Stay,
 * thread 085a980c, 26 November 2026: "make sure other stuff are like for
 * like") reads the same through the admin routes, under the owner's query
 * keys (it keeps its own query client), as a snapshot: nobody can type into
 * the agent, stop it or follow a running turn, and nothing is read again
 * until Refresh.
 */
export interface AgentPanelSource {
  transcript: typeof conversationsQueries.detail;
  agents: typeof agentConversationQueries.of;
}

/** The owner's own routes: every chat page. */
export const OWNER_AGENT_PANEL: AgentPanelSource = {
  transcript: conversationsQueries.detail,
  agents: agentConversationQueries.of,
};

const AgentPanelSourceContext = createContext<AgentPanelSource>(OWNER_AGENT_PANEL);

export const AgentPanelSourceProvider = AgentPanelSourceContext.Provider;

/** Where the agent panel reads from: the owner's routes unless a page says otherwise. */
export function useAgentPanelSource(): AgentPanelSource {
  return useContext(AgentPanelSourceContext);
}
