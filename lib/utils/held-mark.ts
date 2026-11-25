import type { ApiMessage, HeldMark } from '@/types/chat';

/**
 * The mark a saved user message carries while held (chain view, option C):
 * sent while the chat's agents worked and not yet answered. Undefined once a
 * turn took it, and on every other row.
 */
export function heldMarkOf(apiMsg: Pick<ApiMessage, 'role' | 'state' | 'waiting_on'>): HeldMark | undefined {
  if (apiMsg.role !== 'user' || apiMsg.state !== 'held') return undefined;
  return { waitingOn: apiMsg.waiting_on?.agent.name ?? null };
}
