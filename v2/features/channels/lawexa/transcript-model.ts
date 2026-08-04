import type { AiTranscriptMessage } from '@/types/collab';

/**
 * transcript-model — the pure lens that turns a COMPLETE AI session transcript
 * into something a person can read. Phase-5 W3; sources: api-digest §C ("the
 * complete transcript incl. tool machinery — distinguish by `role` +
 * `metadata.type`; filter for dialogue") and study A9 — 2026-08-04.
 *
 * THE BIAS IS TOWARDS SHOWING. The endpoint returns everything the agent did,
 * including rows this frontend has never seen a name for, and the machinery
 * vocabulary belongs to the agent — it can grow without a frontend release. So
 * the rule is an ALLOW-LIST OF MACHINERY, not of dialogue: a row is hidden from
 * the default view only when it says, in a way we recognise, that it is
 * plumbing. Anything unfamiliar is shown, because a hidden real answer is a far
 * worse failure than a visible tool call — and it matches the backend's own
 * contractual instruction that unrecognised `metadata.type` values fall back to
 * being rendered as text.
 *
 * Nothing is ever filtered SERVER-side: "show everything" is a toggle over the
 * same fetched pages, never a second request.
 */

/**
 * Roles that are part of the conversation people had. This is the DOCUMENTED
 * signal (api-digest §C) and it carries the filter.
 */
const DIALOGUE_ROLES = new Set(['user', 'assistant']);

/**
 * `metadata.type` values that mark plumbing even on a dialogue role — the
 * secondary signal, kept deliberately TINY. Compared as plain strings because
 * these names live in the agent's vocabulary, not in `MessageType`.
 *
 * The bar for entry is "certainly machinery, by its own name". Three things
 * were considered and REJECTED, each for a reason worth keeping written down:
 *
 *  - `tool_post` — the opposite of machinery. §F.6 describes it as the mode
 *    where the TOOL POSTS THE REAL ANSWER, several bubbles sharing one
 *    `execution_id`. Hiding those would have hidden the reply itself: the
 *    single worst failure this module can produce, and a direct contradiction
 *    of the bias above.
 *  - `handover` — a sub-agent hand-off carries the specialist's answer text,
 *    which is content a reader wants.
 *  - `system` / `thinking` / `reasoning` — not defensible as certainly
 *    machinery from the name alone (a "system" row could be a user-facing
 *    notice), and the role filter already catches them whenever the row
 *    declares a non-dialogue role, which is the documented way to know.
 */
const MACHINERY_TYPES = new Set(['tool', 'tool_call', 'tool_result']);

/**
 * Is this row part of the readable conversation?
 *
 * A row with NO `role` at all is always dialogue: that is every transcript row
 * the API returned before the machinery shipped, and it is exactly what v1
 * rendered.
 */
export function isDialogueRow(message: AiTranscriptMessage): boolean {
  if (message.role !== undefined && !DIALOGUE_ROLES.has(message.role)) return false;
  const type: string | undefined = message.metadata.type;
  if (type !== undefined && MACHINERY_TYPES.has(type)) return false;
  return true;
}

/**
 * Flatten cursor pages (newest-first) into reading order, optionally keeping
 * only the dialogue. Returns both the visible rows and how many were hidden, so
 * the toggle can say what it is offering instead of being a mystery switch.
 */
export function shapeTranscript(
  pages: readonly { data: AiTranscriptMessage[] }[] | undefined,
  showEverything: boolean,
): { rows: AiTranscriptMessage[]; hiddenCount: number } {
  if (!pages) return { rows: [], hiddenCount: 0 };

  const chronological: AiTranscriptMessage[] = [];
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const page = pages[i].data;
    for (let j = page.length - 1; j >= 0; j -= 1) chronological.push(page[j]);
  }

  if (showEverything) return { rows: chronological, hiddenCount: 0 };

  const rows = chronological.filter(isDialogueRow);
  return { rows, hiddenCount: chronological.length - rows.length };
}

/** A short label for a machinery row's badge — the agent's own word for what
 *  it was doing, tidied for display, never invented. */
export function machineryLabel(message: AiTranscriptMessage): string {
  const type: string | undefined = message.metadata.type;
  const raw = type ?? message.role ?? 'step';
  return raw.replace(/[_-]+/g, ' ');
}
