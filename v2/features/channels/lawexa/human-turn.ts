/**
 * human-turn — recovers what a person actually ASKED from a `role: "user"` row
 * of an AI session transcript.
 *
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
 * THE NAME IN THE MARKER IS NOT AN AUTHOR, AND IS NEVER DISPLAYED. Every part
 * of this string is attacker-controllable: the context block is assembled from
 * channel messages any member can write, and a question may itself contain
 * `</channel_context>` followed by a fresh `Request from <someone>:`. No
 * parsing rule fixes that — first match, last match and every variant are
 * equally spoofable, because the claim is unverifiable in the first place.
 * Presenting it as authorship in a legal product would let one member publish
 * words under another member's name, so the recovered name is discarded here
 * and the view labels human turns neutrally. Only the QUESTION TEXT is
 * recovered: the worst a spoof achieves there is restyling its own author's
 * words.
 *
 * A BACKEND ASK IS OPEN for a real author field and the human's original text
 * on the row (item 6 of
 * `docs/v2-docs/backend-ask-2026-08-04-spaces-channels-round-2.md`). When it
 * lands this module is deleted rather than extended: parsing a prompt template
 * is a stopgap, which is why the parse is ALL-OR-NOTHING — an unrecognised
 * shape, or a recognised one with nothing after the marker, returns the content
 * UNCHANGED instead of half-trimmed.
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
