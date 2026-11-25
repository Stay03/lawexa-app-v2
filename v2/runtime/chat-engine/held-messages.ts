import type { ChatStartResponse, HeldMark } from '@/types/chat';

/**
 * held messages — a message sent while the chat's agents work (chain view,
 * option C; Stay, 25 November 2026, 03:43Z). The server saves and charges it
 * and answers it later, with the agents' report or at once on Stop, so the
 * send starts no turn (HTTP 202, `held: true`, `ai_reply: false`). The row
 * shows at once with a mark naming what it waits for; the mark goes when the
 * turn that answers it starts (`held_messages.answered`) or when the saved
 * copy says it was answered.
 */

/** The mark a send's answer gives its row; null for every send that was not held. */
export function heldMarkFromSend(data: Pick<ChatStartResponse['data'], 'held' | 'message'>): HeldMark | null {
  const held = data.held === true || data.message?.state === 'held';
  if (!held) return null;
  return { waitingOn: data.message?.waiting_on?.agent.name ?? null };
}


/**
 * Rows with the marks of these saved messages removed: their answer has
 * started. Returns the same array when none of them is marked.
 */
export function withHeldReleased<T extends { role: string; savedId?: number; held?: HeldMark }>(
  rows: readonly T[],
  savedIds: readonly number[],
): T[] {
  const ids = new Set(savedIds);
  if (!rows.some((row) => row.held && row.savedId !== undefined && ids.has(row.savedId))) return rows as T[];
  return rows.map((row) => {
    if (!row.held || row.savedId === undefined || !ids.has(row.savedId)) return row;
    const released = { ...row };
    delete released.held;
    return released;
  });
}

/** The words on a held row's mark. */
export function heldMarkWords(mark: HeldMark): string {
  return mark.waitingOn ? `Waiting for ${mark.waitingOn}’s report` : 'Waiting for the agents’ report';
}
