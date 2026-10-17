import type { JurisdictionChoice } from '@/types/jurisdiction';

/**
 * A chat's chosen jurisdiction, kept per conversation for this tab (v1's slot,
 * `sessionStorage`). `auto` is the absence of a choice, so it is never stored.
 * The controller seeds its state from it when a chat opens; the shell's docked
 * box (`ChatDock`) writes it when the reader changes the chip before the chat's
 * screen is up, so the screen opens with the choice already made.
 */
const CONV_JURISDICTION_PREFIX = 'conv_jurisdiction_';

/** The slot's choice, else auto (also on the server and when storage fails). */
export function readJurisdictionSlot(conversationId: string): JurisdictionChoice {
  if (typeof window === 'undefined') return { mode: 'auto' };
  try {
    const raw = window.sessionStorage.getItem(`${CONV_JURISDICTION_PREFIX}${conversationId}`);
    if (!raw) return { mode: 'auto' };
    const parsed = JSON.parse(raw) as JurisdictionChoice;
    return parsed && typeof parsed === 'object' && 'mode' in parsed ? parsed : { mode: 'auto' };
  } catch {
    return { mode: 'auto' };
  }
}

/** Store the choice; auto clears the slot. */
export function writeJurisdictionSlot(conversationId: string, next: JurisdictionChoice): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${CONV_JURISDICTION_PREFIX}${conversationId}`;
    if (next.mode === 'auto') window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    // sessionStorage unavailable: the choice still applies in memory this turn.
  }
}
