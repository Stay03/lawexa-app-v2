/**
 * human-turn — the FALLBACK that recovers what a person asked from a
 * `role: "user"` row of an AI session transcript recorded BEFORE 2026-08-04.
 *
 * ── READ THIS BEFORE DELETING OR EXTENDING IT ─────────────────────────────
 * The backend now sends `user_content` (exactly what the person typed) and
 * `asked_by` (who typed it) on every user turn, and the transcript view
 * PREFERS both. This module is not the primary path any more — it is the only
 * way to read the turns that already existed when that deploy landed. There is
 * no backfill, so those rows carry `content` and nothing else, forever. That is
 * why this file still exists and why it must not be "tidied away" once new
 * sessions look correct on screen: deleting it would silently turn every
 * pre-deploy transcript into a wall of prompt scaffolding.
 *
 * It is equally not somewhere to add features. Anything the transcript needs
 * from a turn now comes from a field on the wire; this parse only ever has to
 * keep working on a fixed, closed set of historical rows.
 *
 * ── WHAT IT UNWRAPS ───────────────────────────────────────────────────────
 * `GET /channels/{uuid}/ai/sessions/{session}` returns the agent's own
 * conversation rows, so a user row's `content` is the prompt the backend
 * ASSEMBLED, never the message the person sent. The measured wire format
 * (production, 2026-08-04) is:
 *
 *     <channel_context channel="…" …>
 *     …recent channel history…
 *     </channel_context>
 *
 *     [2026-08-04 09:12:44] Request from Ada Lovelace: what does section 12 say?
 *
 * Showing that verbatim puts machinery the reader never wrote into their own
 * words, so this module unwraps it.
 *
 * ── THE NAME IN THE MARKER IS NOT AN AUTHOR, AND IS NEVER DISPLAYED ───────
 * Every part of this string is attacker-controllable: the context block is
 * assembled from channel messages any member can write, and a question may
 * itself contain `</channel_context>` followed by a fresh `Request from
 * <someone>:`. No parsing rule fixes that — first match, last match and every
 * variant are equally spoofable, because the claim is unverifiable in the first
 * place. Presenting it as authorship in a legal product would let one member
 * publish words under another member's name, so the recovered name is discarded
 * here and turns that have no `asked_by` are labelled neutrally in the view.
 * `asked_by` is a SERVER field and carries none of this problem, which is
 * precisely why attribution waited for it. Only the QUESTION TEXT is recovered
 * here: the worst a spoof achieves there is restyling its own author's words.
 *
 * The parse is ALL-OR-NOTHING: an unrecognised shape, or a recognised one with
 * nothing after the marker, returns the content UNCHANGED rather than
 * half-trimmed.
 */

/** The close of the assembled prompt's context block, when it carries one. */
const CONTEXT_BLOCK_END = '</channel_context>';

/**
 * `[<timestamp>] Request from <name>: `. Every span is LENGTH-BOUND: this runs
 * over attacker-supplied text, and the unbounded forms backtrack quadratically
 * on a long run of `[` (measured in seconds, not milliseconds). The bounds sit
 * far above a real timestamp and a real display name.
 */
const REQUEST_MARKER = /\[[^\]\n]{0,64}\]\s{0,8}Request from [^\n:]{1,120}:[ \t]{0,8}/;

/**
 * The human's question, or the row's content unchanged when the assembled shape
 * is not recognised. Tolerant of a missing body: `content` is typed a string
 * from measured rows rather than from a published contract, and an agent
 * conversation table can carry an empty one.
 */
export function recoverHumanQuestion(content: string | null | undefined): string {
  if (!content) return '';

  const contextEnd = content.lastIndexOf(CONTEXT_BLOCK_END);
  const tail =
    contextEnd === -1
      ? content
      : content.slice(contextEnd + CONTEXT_BLOCK_END.length);

  const marker = REQUEST_MARKER.exec(tail);
  if (!marker) return content;

  const question = tail.slice(marker.index + marker[0].length).trim();
  return question === '' ? content : question;
}
