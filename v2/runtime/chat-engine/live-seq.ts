/**
 * live-seq — drops a live event the stream relays twice (Backend, 25 November
 * 2026: a reader resumed after a container restart can relay one event again,
 * with the seq it had the first time). Applied the same event twice, the chat
 * doubled words (text_delta), drew a second step (tool_calling), or closed the
 * wrong open step of the same tool (tool_complete).
 *
 * One filter per connection (`connectToStream`), never per turn: a fresh
 * connection is answered with the turn replayed from its start (0-0), and the
 * engine rebuilds the answer from that replay, so a set carried over would
 * drop the replay. Within one connection the transport resumes from its
 * Last-Event-ID, so a repeated seq there is only ever the double relay.
 *
 * Every event's seq is its own within one execution's stream, text_delta
 * included (Backend, ProcessAiRequestV2). An event with no seq always passes:
 * the one such event is a turn stopped before it started, the only event on
 * its stream. Separate from the history set (`dedupKeys`), which text_delta
 * must never be checked against.
 */

/** The event's own top-level seq, or null when it carries none or is not JSON. */
export function liveSeqOf(data: unknown): number | null {
  if (typeof data !== 'string' || data === '') return null;
  try {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const seq = (parsed as Record<string, unknown>).seq;
    return typeof seq === 'number' && Number.isInteger(seq) ? seq : null;
  } catch {
    return null;
  }
}

/** A filter for one connection: true for an event whose seq it has already passed. */
export function createLiveSeqFilter(): (data: unknown) => boolean {
  const seen = new Set<number>();
  return (data) => {
    const seq = liveSeqOf(data);
    if (seq === null) return false;
    if (seen.has(seq)) return true;
    seen.add(seq);
    return false;
  };
}
