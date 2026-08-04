import { queryOptions, replaceEqualDeep } from '@tanstack/react-query';

import { channelQuizApi, quizGamesApi } from '@/lib/api/channel-quiz';
import type { QuizGameStateResponse } from '@/types/channel-quiz';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';
import type { ViewerScoped } from '../queries';
import { isOlderSnapshot, pollDelayMs, POLL_MS } from './model';

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
   * the channel would never learn a game had started. Thirty seconds costs two
   * requests a minute per open channel — nothing beside the game's own
   * cadence — and it pauses with the tab
   * (`refetchIntervalInBackground` stays false).
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
        // A refused or missing game (403/404) must NOT become a heartbeat
        // against the API — the screen shows its designed refusal and offers a
        // manual retry.
        if (query.state.status === 'error') return false;
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
   * the reference tier; a 409 here means the game is still running or was
   * cancelled, which the podium screen renders as a designed state.
   */
  results: ({ gameUuid, viewerId }: GameScoped) =>
    queryOptions({
      queryKey: [...channelQuizQueries.resultsOf(gameUuid), { viewerId }] as const,
      queryFn: () => quizGamesApi.results(gameUuid),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
      retry: false,
    }),
};
