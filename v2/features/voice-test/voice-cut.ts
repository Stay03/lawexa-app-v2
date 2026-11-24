import type { VoiceCut } from './voice-session';

/**
 * "Pick up where the voice was cut" (Stay's option B, 24 November 2026): when
 * the caller cuts the voice off, the page tells the server the reply in full
 * and the part the caller heard, against the turn whose result the page last
 * sent into the call. The server keeps the unread rest, so "carry on" reads
 * exactly that. One try per cut, never a loop: a call that has ended (409) or
 * a turn the server does not know (404) is dropped without a word, and a
 * resend of the same pair is harmless to the server. Nothing changes on screen.
 */
export async function reportCut(
  where: { sessionUuid: string | null; lastSentTurn: string | null },
  cut: VoiceCut,
  post: (sessionUuid: string, turnUuid: string, cut: VoiceCut) => Promise<void>,
): Promise<boolean> {
  // No result has gone into this call yet: there is nothing to pick up.
  if (!where.sessionUuid || !where.lastSentTurn) return false;
  try {
    await post(where.sessionUuid, where.lastSentTurn, cut);
    return true;
  } catch {
    // An ended call, an unknown turn or a dropped request: the call goes on.
    return false;
  }
}
