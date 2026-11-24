import type { VoiceCut } from './voice-session';

/**
 * "Pick up where the voice was cut" (Stay's option B, 24 November 2026): when
 * the caller cuts the voice off while it reads a research result, the page
 * tells the server the reply in full and the part the caller heard, against
 * that result's turn. The server keeps the unread rest, so "carry on" reads
 * exactly that.
 *
 * ONLY THE RESULT'S OWN READING COUNTS (Techlead's review). ElevenLabs sends
 * its correction for any reply it cuts: filler, small talk, an action's
 * outcome, the still-working nudge. So the page watches a turn from the moment
 * its result goes into the call, records the voice's replies from then on,
 * and stops watching as soon as anything else goes in. A cut is told only
 * when its full text is the longest of those replies, which is the reading of
 * the result; a later "Anything else?" never is.
 */
export interface CutWatch {
  /** The research turn whose result the page sent into the call last, or null. */
  turn: string | null;
  /** The voice's replies since that result went in. */
  replies: string[];
}

export const NO_CUT_WATCH: CutWatch = { turn: null, replies: [] };

/** A reply as compared: trimmed, with runs of spaces and line breaks made one space. */
const plain = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Something went into the call: a research result starts a watch on its turn; anything else (an outcome, a nudge) ends it. */
export function watchOnPassIn(researchTurn: string | null): CutWatch {
  return researchTurn ? { turn: researchTurn, replies: [] } : NO_CUT_WATCH;
}

/** The voice said something while a turn is watched. */
export function watchOnReply(watch: CutWatch, text: string): CutWatch {
  const reply = plain(text);
  return watch.turn && reply ? { ...watch, replies: [...watch.replies, reply] } : watch;
}

/** The turn a cut belongs to: the watched turn, when the cut reply is the result's reading; otherwise null. */
export function cutTurnFor(watch: CutWatch, cut: VoiceCut): string | null {
  if (!watch.turn || watch.replies.length === 0) return null;
  const reading = watch.replies.reduce((longest, reply) => (reply.length > longest.length ? reply : longest));
  return plain(cut.full) === reading ? watch.turn : null;
}

/**
 * Tells the server about a cut of the result's reading: one try, never a
 * loop. An ended call (409), an unknown turn (404) or a dropped request is
 * let go without a word; a resend of the same pair is harmless. Nothing
 * changes on screen.
 */
export async function reportCut(
  sessionUuid: string | null,
  watch: CutWatch,
  cut: VoiceCut,
  post: (sessionUuid: string, turnUuid: string, cut: VoiceCut) => Promise<void>,
): Promise<boolean> {
  const turn = cutTurnFor(watch, cut);
  if (!sessionUuid || !turn) return false;
  try {
    await post(sessionUuid, turn, cut);
    return true;
  } catch {
    return false;
  }
}
