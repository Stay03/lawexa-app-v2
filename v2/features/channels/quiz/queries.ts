import { queryOptions, replaceEqualDeep } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { channelQuizApi, quizGamesApi } from '@/lib/api/channel-quiz';
import { extractApiError } from '@/lib/utils/api-error';
import type { QuizGameStateResponse } from '@/types/channel-quiz';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';
import type { ViewerScoped } from '../queries';
import { isOlderSnapshot, pollDelayMs, POLL_MS, recoveryDelayMs } from './model';

/**
 * channel-quiz query factory — the authoring library, the "is a game live
 * here?" probe, the authoritative game state, and a finished game's results.
 *
 * Sources: `docs/api/channel-quiz.md` (backend repo) and `api-digest.md`
 * §C/§E — phase-5 W6, 2026-08-04.
 *
 * ITS OWN ROOT (`['channel-quiz']`), not a branch of `channelsQueries`: the
 * quiz surface has its own client, its own contract doc and its own lifetime,
 * and nothing in the channel's message/list/file writers should ever fan over
 * it by accident. The two factories only meet where the room hook invalidates
 * {@link channelQuizQueries.activeGameOf} on a `.quiz.game.*` event.
 *
 * VIEWER PARTITION, same rule as everywhere in v2: `viewerId` is a cache
 * partition and it is REQUIRED, so forgetting it is a type error rather than a
 * silent cross-account leak. It matters here — `your_answer` and the author
 * view's `is_correct` are both per-viewer.
 */

/**
 * The three statuses that END a game's polling. Everything else — including a
 * bodyless 5xx, a timeout and a rate limit — is a condition that can pass.
 */
const REFUSALS = new Set([401, 403, 404]);

/** How many times a `409` on results is re-asked, and how long apart — sized
 *  for the finish race described on {@link channelQuizQueries.results}, not for
 *  a server that is down. */
const RESULTS_RACE_RETRIES = 2;
const RESULTS_RACE_DELAY_MS = 800;

/**
 * The HTTP status behind a failed read, or `0` when there was no response.
 *
 * NOT `extractApiError` ALONE, and the difference matters here: that helper
 * reads the status off the response BODY's envelope and reports `0` when a
 * response carries no JSON — so a bodyless 403 or 404 from a proxy or an edge
 * would look like a network error and earn an eternal retry beat. The transport
 * knows the status even when the body is empty, so ask the transport first.
 */
function httpStatus(error: unknown): number {
  if (isAxiosError(error) && error.response) return error.response.status;
  return extractApiError(error).status;
}

export interface ChannelScoped extends ViewerScoped {
  channelUuid: string;
}

export interface GameScoped extends ViewerScoped {
  gameUuid: string;
}

export const channelQuizQueries = {
  all: ['channel-quiz'] as const,

  /* ── Authoring ─────────────────────────────────────────────────────────── */

  /** Invalidation handle for one channel's quiz library (all filters/pages). */
  quizzesOf: (channelUuid: string) =>
    [...channelQuizQueries.all, 'quizzes', channelUuid] as const,

  /** The channel's quizzes, newest first. Rows carry `question_count` and
   *  embed no questions, so the library list is cheap to keep warm. */
  quizzes: ({
    channelUuid,
    viewerId,
    mine,
  }: ChannelScoped & { mine: boolean }) =>
    queryOptions({
      queryKey: [
        ...channelQuizQueries.quizzesOf(channelUuid),
        { mine },
        { viewerId },
      ] as const,
      queryFn: () =>
        channelQuizApi.getList(channelUuid, {
          per_page: 30,
          mine: mine ? 1 : undefined,
        }),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  /** Invalidation handle for ONE quiz's detail (every viewer variant). */
  quizDetailOf: (quizUuid: string) =>
    [...channelQuizQueries.all, 'quiz', quizUuid] as const,

  /** A full quiz with its questions. The options carry `is_correct` ONLY when
   *  the server judges this viewer an editor — which is exactly the condition
   *  under which the edit form may be opened, so the form reads the flag it
   *  was given and never guesses. */
  quizDetail: (quizUuid: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...channelQuizQueries.quizDetailOf(quizUuid), { viewerId }] as const,
      queryFn: () => channelQuizApi.show(quizUuid),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  /* ── The live probe ────────────────────────────────────────────────────── */

  /** Invalidation handle for the channel's live-game probe. */
  activeGameOf: (channelUuid: string) =>
    [...channelQuizQueries.all, 'active-game', channelUuid] as const,

  /**
   * "Is a quiz live in this channel right now?" — `?active=1` returns 0 or 1
   * rows by contract (one live game per channel).
   *
   * ONE ENTRY PER CHANNEL, SHARED BY EVERY READER OF IT. The live bar and
   * every quiz card in the transcript read this same key, so a history with
   * twenty quiz cards still opens ONE request. It is invalidated by the room
   * hook on `.quiz.game.live` / `.finished` / `.cancelled`.
   *
   * THE 30-SECOND BEAT IS AN OUTAGE MEASURE, and it should be removed when
   * broadcast emission returns. A game going live is announced by two events
   * this client cannot currently receive (`message.created` for the chat card,
   * `.quiz.game.live` for the probe), so without a beat a member sitting in
   * the channel would never learn a game had started.
   *
   * ITS REAL COST, STATED HONESTLY: the CACHE entry is shared, but the interval
   * is not — every observer of this query owns its own timer, so a feed holding
   * N quiz cards plus the live bar makes up to N+1 staggered reads per 30s
   * rather than one. They are cheap (`active=1` returns at most one row) and
   * they pause with the tab (`refetchIntervalInBackground` stays false), and
   * the whole beat disappears with the outage that justifies it.
   */
  activeGame: ({ channelUuid, viewerId }: ChannelScoped) =>
    queryOptions({
      queryKey: [...channelQuizQueries.activeGameOf(channelUuid), { viewerId }] as const,
      queryFn: () => quizGamesApi.getList(channelUuid, { active: 1, per_page: 1 }),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
      refetchInterval: (query) => (query.state.status === 'error' ? false : 30_000),
    }),

  /* ── The game itself ───────────────────────────────────────────────────── */

  /** Invalidation/write handle for ONE game's state envelope. */
  gameStateOf: (gameUuid: string) =>
    [...channelQuizQueries.all, 'game', gameUuid] as const,

  /**
   * THE AUTHORITATIVE STATE (`GET /quiz-games/{game}`) — the contract's own
   * reconnect endpoint, and this feature's transport of record.
   *
   * `staleTime: live` (0) because every read of a running game must be a real
   * read: the whole point is that a missed broadcast costs nothing. The
   * cadence is computed per snapshot by `pollDelayMs` (see its docblock for
   * the numbers and the reasoning), which also STOPS the polling on a terminal
   * game — a finished or cancelled game never changes again. Polling pauses
   * automatically while the tab is hidden (`refetchIntervalInBackground`
   * defaults to false) and the focus refetch catches the reader up on return.
   *
   * SINCE 2026-08-04 THIS BEAT IS ALSO THE GAME'S RECOVERY. The server runs any
   * overdue transition on a state read (5s past the published deadline), so a
   * game that has stalled — including one stuck on its final question — is
   * unstuck by the next request this query makes. Nothing here may back off or
   * give up while a game is non-terminal; that is why the error branch below
   * distinguishes a refusal from weather.
   *
   * TWO WRITERS, ONE ORDER (`structuralSharing`). This entry is written by BOTH
   * the poll and the event merges in `./use-game.ts`, and a request already in
   * flight when an event lands would otherwise overwrite it with an older
   * truth — closing a question mid-answer or wiping a reveal. The custom
   * sharing function makes the entry MONOTONIC: a response that sits earlier on
   * the game's timeline (or that has lost a `your_answer` we already hold) is
   * dropped, and anything newer goes through `replaceEqualDeep` exactly as the
   * default would, so unchanged polls keep their object identity and never
   * re-render the screen. The ordering itself lives in `./model.ts`
   * (`isOlderSnapshot`), shared with the event merges so the two writers can
   * never disagree about what "newer" means.
   */
  gameState: ({ gameUuid, viewerId }: GameScoped) =>
    queryOptions({
      queryKey: [...channelQuizQueries.gameStateOf(gameUuid), { viewerId }] as const,
      queryFn: () => quizGamesApi.show(gameUuid),
      staleTime: STALE_TIMES.live,
      gcTime: GC_TIMES.list,
      structuralSharing: (previous, incoming) => {
        const before = previous as QuizGameStateResponse | undefined;
        const next = incoming as QuizGameStateResponse;
        if (before && isOlderSnapshot(next.data, before.data)) return before;
        return replaceEqualDeep(before, next);
      },
      refetchInterval: (query) => {
        // A REFUSAL is an answer, and re-asking cannot change it: a game this
        // viewer may not watch (403), one that does not exist (404), or a
        // session that is no longer signed in (401). None of those may become a
        // heartbeat against the API — the screen shows its designed state and
        // offers a manual retry.
        //
        // ANY OTHER FAILURE IS WEATHER, and giving up on it would be the worst
        // possible moment to stop: the game is still running on the server, and
        // since the round-2 reply our read is ALSO what drives an overdue game
        // forward. A screen that stopped polling after one bad response would
        // freeze the room it was supposed to unfreeze. So it keeps a beat that
        // widens with each consecutive failure (`recoveryDelayMs`) — quick
        // enough for a blip, bounded enough that a dead backend is asked twice
        // a minute rather than twelve times.
        if (query.state.status === 'error') {
          const status = httpStatus(query.state.error);
          if (REFUSALS.has(status)) return false;
          return recoveryDelayMs(
            query.state.fetchFailureCount,
            status === 429,
          );
        }
        const snapshot = query.state.data;
        // No snapshot yet: keep the tightest sensible beat rather than giving
        // up — the game may already be mid-question.
        if (!snapshot) return POLL_MS.countdown;
        return pollDelayMs(snapshot.data, Date.now());
      },
    }),

  /** Invalidation handle for one finished game's results. */
  resultsOf: (gameUuid: string) =>
    [...channelQuizQueries.all, 'results', gameUuid] as const,

  /**
   * A finished game's full results — podium, ranking, per-question stats.
   * Immutable once it exists (a finished game is history), so it is cached on
   * the reference tier.
   *
   * THE `409` IS RETRIED, AND ONLY THE `409`. This read now fires at the exact
   * instant a game finishes (the closing card asks for it the moment the status
   * flips), which is the one moment the server can still answer "not finished"
   * — a race, not a verdict. Left alone, that answer would be cached for ten
   * minutes and the screen would tell a player who just played to the end that
   * their game kept no scores. Two quick re-asks cost nothing and turn the race
   * into a non-event; a genuinely cancelled game answers 409 three times, which
   * is still the truth, and the screen says so with a way to ask again.
   *
   * Every other status keeps `retry: false` — a 403/404 will not improve, and
   * the podium's error state offers the retry.
   */
  results: ({ gameUuid, viewerId }: GameScoped) =>
    queryOptions({
      queryKey: [...channelQuizQueries.resultsOf(gameUuid), { viewerId }] as const,
      queryFn: () => quizGamesApi.results(gameUuid),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
      retry: (failureCount, error) =>
        httpStatus(error) === 409 && failureCount < RESULTS_RACE_RETRIES,
      retryDelay: RESULTS_RACE_DELAY_MS,
    }),
};
