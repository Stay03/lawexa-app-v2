import type { Message, SlimUser } from '@/types/collab';

/**
 * turns — the pure vocabulary of the "Lawexa is responding" state machine.
 * Phase-5 W3; sources: plan W3 item 5, `api-digest.md` §B (`.ai.turn_started` /
 * `.ai.turn_failed`), §F.6 (null `execution_id` on pre-2026-08-03 history;
 * `tool_post` mode shares ONE id across several bubbles) and §F.7 (the
 * `message_uuid` contradiction) — 2026-08-04.
 *
 * THE MACHINE, IN FULL. A turn is born on `.ai.turn_started` and dies exactly
 * three ways:
 *
 *  1. THE REPLY LANDS. The first `message.created` whose
 *     `metadata.execution_id` equals the turn's id clears it. FIRST match, not
 *     last: in `tool_post` mode several bubbles carry the same id, and the row
 *     must go the moment the reader has something to read.
 *  2. THE TURN FAILS. `.ai.turn_failed` clears it. Nothing posts on failure —
 *     this event is the only signal that will ever arrive, which is why the row
 *     must not depend on a message to disappear.
 *  3. NOTHING ARRIVES. A {@link RESPONDING_TURN_TTL_MS} backstop clears it.
 *
 * WHY THE TTL IS A BACKSTOP AND NOT A HEURISTIC. v1 cleared the OLDEST active
 * turn on any AI message, because messages carried no execution id — so two
 * concurrent summons routinely resolved each other's pills. Ids shipped
 * 2026-08-03 and that guess is now deleted: an AI message with a NULL id (all
 * pre-Aug-3 history, and any message the server can't attribute) clears
 * NOTHING. It is better for a row to fade on its own timer than to lie about
 * which question was answered.
 *
 * ANCHORING IS TOLERANT (§F.7). One realtime doc documents `message_uuid` on
 * the event and the other omits it, and the contradiction is unresolved on the
 * wire. So the row anchors under the summoning message when the id is there and
 * falls back to a channel-level row at the foot of the transcript when it is
 * not — both are designed states, neither is a degraded one.
 */

export interface RespondingTurn {
  /** The summon's execution id — the join key for the reply, the failure event
   *  and the glance stream (`GET /api/chat/stream/{execution_id}`). */
  executionId: string;
  summoner: SlimUser;
  /** The message that summoned Lawexa, when the event carried it (§F.7). */
  messageUuid: string | null;
  /** Client clock at arrival — only used for stable ordering of the fallback
   *  rows, never for expiry (that is a timer, not a comparison). */
  startedAt: number;
}

/** How long a turn may stay on screen with no reply and no failure. Matches
 *  v1's backstop; long enough for a slow multi-tool answer, short enough that a
 *  dropped socket doesn't leave a permanent ghost. */
export const RESPONDING_TURN_TTL_MS = 120_000;

/** Add a turn, ignoring a duplicate id (a re-delivered event must not stack a
 *  second row). Returns the SAME array when nothing changed. */
export function addRespondingTurn(
  turns: readonly RespondingTurn[],
  turn: RespondingTurn,
): readonly RespondingTurn[] {
  if (turns.some((existing) => existing.executionId === turn.executionId)) return turns;
  return [...turns, turn];
}

/** Remove a turn by id. Returns the SAME array when it wasn't there. */
export function dropRespondingTurn(
  turns: readonly RespondingTurn[],
  executionId: string,
): readonly RespondingTurn[] {
  if (!turns.some((existing) => existing.executionId === executionId)) return turns;
  return turns.filter((existing) => existing.executionId !== executionId);
}

/**
 * The execution id an incoming message RESOLVES, or `null` when it resolves
 * nothing. Only Lawexa-authored, non-divider messages carrying an id qualify —
 * an `ai_divider` is a session boundary, not an answer, and a null id is
 * unattributable history (see the docblock's rule 3).
 */
export function resolvedExecutionId(message: Message): string | null {
  if (!message.is_ai) return null;
  if (message.metadata.type === 'ai_divider') return null;
  return message.metadata.execution_id ?? null;
}

/** Turns that anchor under a specific message, indexed by that message's uuid.
 *  At most one row per message — a second summon of the same message would be
 *  a server-side impossibility, and the last one wins harmlessly. */
export function anchoredTurns(
  turns: readonly RespondingTurn[],
): Map<string, RespondingTurn> {
  const map = new Map<string, RespondingTurn>();
  for (const turn of turns) {
    if (turn.messageUuid) map.set(turn.messageUuid, turn);
  }
  return map;
}

/** Turns with no anchor — rendered at the foot of the transcript, oldest first
 *  so concurrent summons queue in the order they were made (§F.7 fallback). */
export function unanchoredTurns(
  turns: readonly RespondingTurn[],
): RespondingTurn[] {
  return turns
    .filter((turn) => turn.messageUuid === null)
    .sort((a, b) => a.startedAt - b.startedAt);
}
