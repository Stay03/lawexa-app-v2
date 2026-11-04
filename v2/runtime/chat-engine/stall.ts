/**
 * stall — when a live answer's stream has stopped carrying the answer, so the
 * engine stops waiting on it and asks the server instead (Lucy, 20 October
 * 2026, 15:50Z: a phone sat on one narration line for more than 10 s while the
 * server ran five more tool calls and finished; reopening showed the answer).
 *
 * Two signs, both measured, never counted:
 *
 * 1. SILENT: no event of any kind, heartbeats included, for
 *    {@link STALL_SILENCE_MS}. The server sends a heartbeat every 5 s while
 *    nothing else is going out (ChatStreamController: XREAD BLOCK 5000, then a
 *    heartbeat), so fifteen seconds of nothing, three missed heartbeats, is a dead
 *    connection (a phone's radio or network dropped it without the socket being
 *    told).
 * 2. RECONNECT WITH NOTHING: the transport noticed a drop and reconnected, and
 *    no progress event (text, a tool step, the end) has come for
 *    {@link STALL_RECONNECT_MS} since. The server's older stream path cannot
 *    replay what the dropped connection had already taken, so there a
 *    reconnected stream can carry heartbeats and never the rest of the answer.
 *
 * Either way the engine asks the server for the turn's status at once and
 * then every few seconds, and loads the finished conversation when it is done:
 * the path a reopen already takes, which showed Lucy the full answer.
 *
 * Pure, so it is tested with plain numbers.
 */

/** No event at all for this long is a dead connection: 3x the 5 s heartbeat. */
export const STALL_SILENCE_MS = 15_000;

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

/**
 * A stream quiet this long, one 5 s heartbeat missed, gets one status check
 * while it stays open (the techlead, 4 November 2026: on desktop the stream
 * went quiet 14 to 28 s after the answer was saved, its final event never
 * came). A saved answer is loaded then, not after {@link STALL_SILENCE_MS}.
 */
export const STALL_QUIET_CHECK_MS = 6_000;

/**
 * Whether the quiet stream is due its status check: quiet for
 * {@link STALL_QUIET_CHECK_MS}, and not checked since its last event. One check
 * per quiet spell; any event starts a new spell.
 */
export function quietCheckDue(clock: { now: number; lastEventAt: number; checkedAt: number }): boolean {
  return clock.now - clock.lastEventAt >= STALL_QUIET_CHECK_MS && clock.checkedAt < clock.lastEventAt;
}

/**
 * How much of the quiet spell, since the last event, the page spent hidden: 0
 * when it stayed in view. A phone freezes a page in the background (another
 * app, a locked screen), and its stream with it: on return the gap is the time
 * away, not a fault of the stream. `hiddenFrom` is when the page last went
 * hidden (0: not since it opened), `hiddenUntil` when it came back (0: still
 * hidden).
 */
export function hiddenDuring(gap: { now: number; lastEventAt: number; hiddenFrom: number; hiddenUntil: number }): number {
  if (gap.hiddenFrom <= 0) return 0;
  const end = gap.hiddenUntil > 0 ? Math.min(gap.hiddenUntil, gap.now) : gap.now;
  return Math.max(0, end - Math.max(gap.hiddenFrom, gap.lastEventAt));
}
