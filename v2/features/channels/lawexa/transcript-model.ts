import type { AiTranscriptMessage, SlimUser } from '@/types/collab';
import { recoverHumanQuestion } from './human-turn';

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
 * `metadata` is optional on the resource, and its absence says nothing about
 * the row — an unmarked row is dialogue if its role is.
 */
export function isDialogueRow(message: AiTranscriptMessage): boolean {
  if (!DIALOGUE_ROLES.has(message.role)) return false;
  const type = message.metadata?.type;
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

/* ── The human side of a turn ─────────────────────────────────────────────── */

/** One user turn, resolved from whichever of the two eras its row belongs to. */
export interface HumanTurn {
  /** What the person asked. */
  text: string;
  /**
   * Who asked, when the SERVER says so. `null` on every turn recorded before
   * 2026-08-04 — and `null` is not "unknown enough to guess": see below.
   */
  askedBy: SlimUser | null;
  /** The channel message that summoned this turn, when the row carries it. */
  channelMessageUuid: string | null;
}

/**
 * Resolve a `role: "user"` transcript row into what to show.
 *
 * ── TWO ERAS, ONE FUNCTION ────────────────────────────────────────────────
 * Since 2026-08-04 the server sends `user_content` — exactly what the person
 * typed — alongside the assembled prompt in `content`. Rows written before
 * that deploy have only `content`, and there is no backfill, so the fallback
 * parse in {@link recoverHumanQuestion} still runs for them and only for them.
 * `user_content` wins whenever it is there and non-empty; an empty string is
 * treated as absent, because a turn with no words is a row we should read the
 * old way rather than render as blank.
 *
 * ── WHY ATTRIBUTION IS `asked_by` OR NOTHING ──────────────────────────────
 * The assembled prompt contains a name (`Request from <name>:`), and that name
 * is worthless as an identity: the prompt is built out of channel messages any
 * member can write, so any member can put any name in it. We refused to show a
 * questioner for exactly that reason. `asked_by` is stamped by the server from
 * the authenticated summoner, so it is the first attribution that has ever been
 * safe to print — and it is the ONLY one. A row without it keeps the neutral
 * treatment. Do not "improve" this by falling back to the parsed name: that
 * would let one member publish words under another member's name in a legal
 * product, which is the whole reason the parse discards it.
 */
export function humanTurn(message: AiTranscriptMessage): HumanTurn {
  const typed = message.user_content?.trim();
  return {
    text:
      typed !== undefined && typed !== ''
        ? typed
        : recoverHumanQuestion(message.content),
    askedBy: message.asked_by ?? null,
    channelMessageUuid: message.metadata?.channel_message_uuid ?? null,
  };
}

/** A short label for a machinery row's badge — the agent's own word for what
 *  it was doing, tidied for display, never invented. `role` is required by a
 *  type WE inferred from measured rows, not by a published contract, so the
 *  chain still ends in a literal: a row without one must get a dull badge, not
 *  a TypeError inside the "Show everything" view. */
export function machineryLabel(message: AiTranscriptMessage): string {
  const raw = message.metadata?.type ?? message.role ?? 'step';
  return raw.replace(/[_-]+/g, ' ');
}
