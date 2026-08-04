import type {
  QuizAnswerProgressPayload,
  QuizCancelledPayload,
  QuizCountdownPayload,
  QuizFinishedPayload,
  QuizGameLivePayload,
  QuizPlayerJoinedPayload,
  QuizQuestionClosedPayload,
  QuizQuestionOpenedPayload,
} from '@/types/channel-quiz';

/**
 * game-bus — the one-way pipe from the channel's presence-room subscription to
 * whatever quiz surface happens to be mounted.
 *
 * WHY A BUS AND NOT A SECOND SUBSCRIPTION. The eight `.quiz.game.*` events ride
 * the channel's EXISTING presence room (digest §B — no new subscription), and
 * that room has exactly one owner: `../room.ts`. A second hook calling
 * `echo.join()` would get the same channel object back, and its cleanup's
 * `echo.leave()` would tear the room down under the chat feed. So the room
 * hook stays the only socket citizen: it listens for the eight names and
 * republishes them here, and the game screen subscribes to this instead.
 *
 * The bus is deliberately dumb — no state, no replay, no ordering guarantees.
 * It is a HINT CHANNEL: every event tells the game "something moved", and the
 * game's authority remains `GET /api/quiz-games/{game}`. That is what makes
 * the current production outage (broadcast emission down, backend ask
 * 2026-08-04) a degradation in latency rather than in function, and what makes
 * a duplicated or dropped frame harmless when emission returns.
 *
 * Phase-5 W6, 2026-08-04.
 */

/** The eight events, tagged for exhaustive handling. */
export type QuizGameEvent =
  | { type: 'live'; payload: QuizGameLivePayload }
  | { type: 'player_joined'; payload: QuizPlayerJoinedPayload }
  | { type: 'countdown'; payload: QuizCountdownPayload }
  | { type: 'question_opened'; payload: QuizQuestionOpenedPayload }
  | { type: 'answer_progress'; payload: QuizAnswerProgressPayload }
  | { type: 'question_closed'; payload: QuizQuestionClosedPayload }
  | { type: 'finished'; payload: QuizFinishedPayload }
  | { type: 'cancelled'; payload: QuizCancelledPayload };

/** Which game an event is about. `live` is the odd one out — it carries the
 *  whole game object rather than a `game_uuid`. */
export function eventGameUuid(event: QuizGameEvent): string {
  return event.type === 'live' ? event.payload.game.uuid : event.payload.game_uuid;
}

type Listener = (event: QuizGameEvent) => void;

/** Listeners are keyed by CHANNEL because that is the subscription's scope;
 *  a listener filters down to its own game with {@link eventGameUuid}. */
const listeners = new Map<string, Set<Listener>>();

export function subscribeToQuizGameEvents(
  channelUuid: string,
  listener: Listener,
): () => void {
  let set = listeners.get(channelUuid);
  if (!set) {
    set = new Set();
    listeners.set(channelUuid, set);
  }
  set.add(listener);
  return () => {
    const current = listeners.get(channelUuid);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(channelUuid);
  };
}

/** Fan an event out to this channel's listeners. Iterates a COPY so a
 *  listener that unsubscribes itself mid-dispatch cannot corrupt the walk. */
export function publishQuizGameEvent(
  channelUuid: string,
  event: QuizGameEvent,
): void {
  const set = listeners.get(channelUuid);
  if (!set || set.size === 0) return;
  for (const listener of [...set]) listener(event);
}
