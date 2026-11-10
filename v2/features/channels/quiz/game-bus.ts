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
import { quizRoomKey, type QuizRoom } from './quiz-room';

/**
 * game-bus — the one-way pipe from a room's socket subscription to whatever
 * quiz surface happens to be mounted.
 *
 * WHY A BUS AND NOT A SECOND SUBSCRIPTION. The eight `.quiz.game.*` events ride
 * the room's EXISTING subscription (digest §B — no new subscription): a
 * channel's presence room, owned by `../room.ts`, or a Space's private
 * `spaces.{uuid}`, shared by its listeners (`use-space-quiz-live.ts`, the task
 * board). A screen calling `echo.join()` itself would get the same channel
 * object back, and its cleanup's `echo.leave()` would tear it down under its
 * owner. So the subscription's owner listens for the eight names and
 * republishes them here, and the game screen subscribes to this instead.
 *
 * The bus is deliberately dumb — no state, no replay, no ordering guarantees.
 * It is a HINT CHANNEL: every event tells the game "something moved", and the
 * game's authority remains `GET /api/quiz-games/{game}`. That is what makes
 * the current production outage (broadcast emission down, backend ask
 * 2026-08-04) a degradation in latency rather than in function, and what makes
 * a duplicated or dropped frame harmless when emission returns.
 *
 * Phase-5 W6, 2026-08-04. Keyed by room since live quiz in Spaces (10
 * November 2026).
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

/** Listeners are keyed by ROOM because that is the subscription's scope;
 *  a listener filters down to its own game with {@link eventGameUuid}. */
const listeners = new Map<string, Set<Listener>>();

export function subscribeToQuizGameEvents(room: QuizRoom, listener: Listener): () => void {
  const key = quizRoomKey(room);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(key);
  };
}

/** Fan an event out to this room's listeners. Iterates a COPY so a
 *  listener that unsubscribes itself mid-dispatch cannot corrupt the walk. */
export function publishQuizGameEvent(room: QuizRoom, event: QuizGameEvent): void {
  const set = listeners.get(quizRoomKey(room));
  if (!set || set.size === 0) return;
  for (const listener of [...set]) listener(event);
}

/** The eight wire names, one per event type (the same on a channel and a Space). */
const QUIZ_GAME_EVENT_NAMES = {
  live: '.quiz.game.live',
  player_joined: '.quiz.game.player_joined',
  countdown: '.quiz.game.countdown',
  question_opened: '.quiz.game.question_opened',
  answer_progress: '.quiz.game.answer_progress',
  question_closed: '.quiz.game.question_closed',
  finished: '.quiz.game.finished',
  cancelled: '.quiz.game.cancelled',
} as const satisfies Record<QuizGameEvent['type'], string>;

/** The events that change the answer to "is a quiz live here?". */
const LIVE_CHANGES: ReadonlySet<QuizGameEvent['type']> = new Set(['live', 'finished', 'cancelled']);

/** Just what the relay needs of an Echo channel: a channel's presence room or a Space's private channel. */
export interface QuizEventSource {
  listen(event: string, callback: (payload: never) => void): unknown;
  stopListening(event: string, callback?: (payload: never) => void): unknown;
}

/**
 * Relay the eight `.quiz.game.*` events from a room's subscription onto the
 * bus, for whoever owns that subscription (`../room.ts` for a channel,
 * `use-space-quiz-live.ts` for a Space). `onLiveChange` runs on a game going
 * live, finishing or being cancelled: the owner refreshes its live probe.
 * Returns the cleanup, which stops only these listeners — a Space's channel is
 * shared with other listeners and must stay subscribed for them.
 */
export function relayQuizGameEvents(
  source: QuizEventSource,
  room: QuizRoom,
  onLiveChange: () => void,
): () => void {
  const stops: (() => void)[] = [];
  for (const type of Object.keys(QUIZ_GAME_EVENT_NAMES) as QuizGameEvent['type'][]) {
    const name = QUIZ_GAME_EVENT_NAMES[type];
    const callback = (payload: never) => {
      publishQuizGameEvent(room, { type, payload } as QuizGameEvent);
      if (LIVE_CHANGES.has(type)) onLiveChange();
    };
    source.listen(name, callback);
    stops.push(() => source.stopListening(name, callback));
  }
  return () => {
    for (const stop of stops) stop();
  };
}
