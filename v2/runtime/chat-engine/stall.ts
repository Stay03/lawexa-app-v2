/**
 * stall — when a live answer's stream has stopped carrying the answer, so the
 * engine stops waiting on it and asks the server instead (Lucy, 20 October
 * 2026, 15:50Z: a phone sat on one narration line for more than 10 s while the
 * server ran five more tool calls and finished; reopening showed the answer).
 *
 * Two signs, both measured, never counted:
 *
 * 1. SILENT: no event of any kind, heartbeats included, for
 *    {@link STALL_SILENCE_MS}. The server sends a heartbeat at least every 5 s
 *    while it works, so ten seconds of nothing is a dead connection (a phone's
 *    radio or network dropped it without the socket being told).
 * 2. RECONNECT WITH NOTHING: the transport noticed a drop and reconnected, and
 *    no progress event (text, a tool step, the end) has come for
 *    {@link STALL_RECONNECT_MS} since. The server's stream cannot replay what
 *    the dropped connection had already taken, so a reconnected stream can
 *    carry heartbeats and never the rest of the answer.
 *
 * Either way the engine asks the server for the turn's status at once and
 * then every few seconds, and loads the finished conversation when it is done:
 * the path a reopen already takes, which showed Lucy the full answer.
 *
 * Pure, so it is tested with plain numbers.
 */

/** No event at all for this long is a dead connection. */
export const STALL_SILENCE_MS = 10_000;

/** A reconnected stream with no progress for this long cannot finish the answer. */
export const STALL_RECONNECT_MS = 5_000;

/** How often the engine asks {@link stallVerdict}. */
export const STALL_CHECK_MS = 1_000;

export interface StallClock {
  now: number;
  /** The last event of any kind, heartbeats included. */
  lastEventAt: number;
  /** The last progress event (text, a tool step, the end); 0 before the first. */
  lastProgressAt: number;
  /** When the transport began reconnecting after a drop; 0 when it has not. */
  reconnectingSince: number;
}

export type StallVerdict = 'live' | 'silent' | 'reconnected-empty';

export function stallVerdict(clock: StallClock): StallVerdict {
  if (clock.now - clock.lastEventAt >= STALL_SILENCE_MS) return 'silent';
  if (
    clock.reconnectingSince > 0 &&
    clock.lastProgressAt <= clock.reconnectingSince &&
    clock.now - clock.reconnectingSince >= STALL_RECONNECT_MS
  ) {
    return 'reconnected-empty';
  }
  return 'live';
}
