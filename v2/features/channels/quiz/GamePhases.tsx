'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  Check,
  Eye,
  Loader2,
  LogIn,
  Play,
  Timer,
  Trophy,
  Users,
  WifiOff,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuizGameState, QuizRankingRow } from '@/types/channel-quiz';
import type { SlimUser } from '@/types/collab';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { useEngagementThrottled } from '../engagement-throttle';
import { channelQuizQueries } from './queries';
import type { QuizShareStanding } from '@/lib/constants/quiz-share';
import { ShareResults } from './ShareResults';
import {
  AnswersInRail,
  CountdownDial,
  GameStage,
  GameStageSkeleton,
  Leaderboard,
  NextQuestionCountdown,
  OptionTile,
  PhaseRow,
  PlayerChip,
  QuestionTimer,
  RankRow,
  rankingDetail,
  StageKicker,
  type OptionState,
} from './ui';
import {
  answersIn,
  canJoinNow,
  isRevealedQuestion,
  LOBBY_IDLE_LIMIT_MINUTES,
  nextQuestionOpensAt,
  questionNumber,
  SPEED_SCORING_NOTE,
  totalPicks,
} from './model';
import type { AnswerStanding, FinalAnswerClose, LiveGame } from './use-game';

/**
 * GamePhases — the six things a live game can look like: lobby, count-in,
 * question, reveal, podium, cancelled.
 *
 * Phase-5 W6; sources: `docs/api/channel-quiz.md` (backend repo) and
 * `api-digest.md` §E. Design: design-research OWNER FEEL DIRECTIVE —
 * "Discord's fluidity, Linear's cleanliness, our gold", dark theme
 * first-class.
 *
 * ONE SCREEN FOR QUESTION AND REVEAL. They are the same object in two states,
 * not two screens: the question text, the four tiles and the timer rail stay
 * exactly where they are and the tiles simply change what they say about
 * themselves. Nothing reflows at the reveal, so a reader's eye never has to
 * find its place again — which is the difference between a game that feels
 * alive and one that feels jumpy.
 *
 * REFUSALS ARE STATES, NOT ERRORS (the house rule, and doubly true here): a
 * closed question, a late join, a cancelled game and an already-recorded
 * answer are all RULES of the game. Each is a sentence on the screen where it
 * happened. Nothing in this file raises a toast.
 *
 * COLOUR NOTE (audit M4). Correct/incorrect use the app's existing semantic
 * pair — emerald for right, `destructive` for wrong — but the two places
 * emerald carries TEXT use `emerald-700` in light rather than the
 * `emerald-600` the rest of the app reaches for, because 600 on a tinted chip
 * falls under 4.5:1. Dark stays on 400. The house-wide sweep (23 emerald sites
 * across the app, 21 of them outside this wave) is a phase-6 token follow-up
 * and deliberately NOT touched here.
 */

/* ── Lobby ────────────────────────────────────────────────────────────────── */

export function LobbyStage({ game }: { game: LiveGame }) {
  const state = game.state;
  if (!state) return null;
  const players = state.game.players ?? [];
  const count = state.game.player_count ?? players.length;
  const hostUuid = state.game.host?.uuid ?? null;
  const joinable = canJoinNow(state) && !game.isPlaying;

  return (
    <GameStage>
      <div className="text-center">
        <StageKicker>Waiting to start</StageKicker>
        <h2 className="mt-2 text-2xl font-semibold text-balance text-foreground">
          {state.game.quiz.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.game.question_count}{' '}
          {state.game.question_count === 1 ? 'question' : 'questions'} ·{' '}
          {SPEED_SCORING_NOTE}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        {/* NOT a live region (audit L11). The overlay's status region is this
            mode's ONE announcer; a busy lobby announcing every arrival would
            talk over the count-in a screen-reader user needs to hear. */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users aria-hidden className="size-4" />
          <span>
            {count} {count === 1 ? 'player' : 'players'} in the lobby
          </span>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {players.map((player) => (
            <PlayerChip
              key={player.user.uuid}
              user={player.user}
              host={player.user.uuid === hostUuid}
            />
          ))}
          {players.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              Nobody has joined yet.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        {joinable && (
          <Button size="lg" onClick={game.join} disabled={game.joining}>
            {game.joining ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <LogIn aria-hidden className="size-4" />
            )}
            Join this game
          </Button>
        )}

        {game.isHost && (
          <Button
            size="lg"
            onClick={game.start}
            disabled={game.starting || count === 0}
          >
            {game.starting ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Play aria-hidden className="size-4" />
            )}
            Start the game
          </Button>
        )}

        {!game.isHost && (
          <p className="text-sm text-muted-foreground">
            {state.game.host
              ? `${state.game.host.name} starts the game when everyone is in.`
              : 'The host starts the game when everyone is in.'}
          </p>
        )}

        <p className="max-w-sm text-center text-xs text-muted-foreground/80">
          Everyone answers on their own device. A lobby nobody starts closes
          itself after {LOBBY_IDLE_LIMIT_MINUTES} minutes
          {state.game.settings.allow_late_join
            ? ' · late joiners play from the next question'
            : ' · nobody can join once it starts'}
          .
        </p>
      </div>
    </GameStage>
  );
}

/* ── Count-in ─────────────────────────────────────────────────────────────── */

export function CountdownStage({ game }: { game: LiveGame }) {
  const state = game.state;
  if (!state) return null;
  return (
    <GameStage className="items-center">
      <StageKicker>{state.game.quiz.title}</StageKicker>
      <CountdownDial deadline={state.game.countdown_ends_at} />
      <p className="text-sm text-muted-foreground">
        {state.game.question_count}{' '}
        {state.game.question_count === 1 ? 'question' : 'questions'} coming up
      </p>
      {!game.isPlaying && <WatchingNote />}
    </GameStage>
  );
}

/* ── Question ⇄ reveal ────────────────────────────────────────────────────── */

function optionState(
  optionId: number,
  myPick: number | null,
  correctId: number | null | undefined,
): OptionState {
  // One nullish rule across the feature (audit L3) — `isRevealedQuestion` is
  // the same test on the question as a whole.
  if (correctId == null) {
    if (myPick === null) return 'idle';
    return myPick === optionId ? 'picked' : 'locked-other';
  }
  if (optionId === correctId) return 'correct';
  if (myPick === optionId) return 'wrong-pick';
  return 'missed';
}

export function QuestionStage({
  game,
  viewerUuid,
}: {
  game: LiveGame;
  viewerUuid: string | null;
}) {
  const state = game.state;
  const current = state?.current_question;
  const throttled = useEngagementThrottled('quiz-answer');

  // The server says a question phase is running but has not handed us the
  // question yet (a merge that arrived without a body, a poll mid-flight).
  if (!state || !current) return <GameStageSkeleton />;

  const revealed = isRevealedQuestion(current);
  const standing = game.answerStanding;
  // TWO DIFFERENT QUESTIONS, TWO DIFFERENT ANSWERS.
  //
  // "Is this reader done here?" locks the grid, and a local tap settles it —
  // the second tap must not leave the device even while the first is in flight.
  //
  // "Which option gets the verdict?" may only ever be answered by the SERVER.
  // A question can close early while a POST is in flight, so the reveal can
  // land before the refusal does; painting the tapped tile would then put an
  // emerald tick — and a screen-reader "Correct answer" — on an answer this
  // player never actually gave, two rows above `RevealResult` saying they
  // didn't answer at all.
  const answered = standing.kind !== 'none' || game.pendingOptionId !== null;
  const judgedPick = standing.kind === 'answered' ? standing.optionId : null;
  const lockedPick = judgedPick ?? game.pendingOptionId;
  const picks = totalPicks(current.option_counts, current.no_answer_count);
  const countFor = (optionId: number) =>
    current.option_counts?.find((entry) => entry.option_id === optionId)?.count;

  return (
    <GameStage>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <StageKicker>
            Question {questionNumber(current, state.game.question_count)} of{' '}
            {state.game.question_count}
          </StageKicker>
          {/* THE SCREEN STOPS BEING SILENT ABOUT WHAT COMES NEXT. `is_final`
              rides the state read in both question phases, so the last question
              can say so while it is still being answered — and the podium then
              arrives as the ending everyone was told about rather than as a
              jump. Gold, because it is the one thing on this screen worth
              marking. */}
          {current.is_final && (
            <span className="shrink-0 text-xs font-medium text-primary">
              Last question
            </span>
          )}
        </div>

        {revealed ? (
          <NextQuestionCountdown
            opensAt={nextQuestionOpensAt(state)}
            isFinal={current.is_final}
          />
        ) : (
          <QuestionTimer deadline={current.ends_at} opensAt={current.opens_at} />
        )}
      </div>

      <h2 className="text-xl leading-snug font-semibold text-balance text-foreground sm:text-2xl">
        {current.question.question}
      </h2>

      <div
        className={cn(
          'grid gap-3',
          current.question.options.length > 2 && 'sm:grid-cols-2',
        )}
      >
        {current.question.options.map((option, index) => {
          const count = countFor(option.id);
          return (
            <OptionTile
              key={option.id}
              index={index}
              content={option.content}
              state={optionState(
                option.id,
                revealed ? judgedPick : lockedPick,
                current.correct_option_id,
              )}
              share={revealed && picks > 0 ? (count ?? 0) / picks : undefined}
              count={revealed ? (count ?? 0) : undefined}
              disabled={answered || throttled || game.answering}
              onSelect={
                revealed || !game.isPlaying || answered
                  ? undefined
                  : () => game.submitAnswer(option.id)
              }
            />
          );
        })}
      </div>

      {/* Who is in, and how fast — the same beat as everything else on this
          screen, straight off `current_question.answers_in`. */}
      <AnswersInRail answers={answersIn(current)} />

      {/* ── The line under the grid: one honest sentence per situation ─── */}
      <div className="min-h-10">
        {revealed ? (
          <RevealResult
            state={state}
            standing={standing}
            isPlaying={game.isPlaying}
          />
        ) : !game.isPlaying ? (
          <WatchingNote />
        ) : game.answerNote ? (
          <p className="text-sm text-muted-foreground">{game.answerNote}</p>
        ) : throttled ? (
          <p className="text-sm text-muted-foreground">
            Answers are coming in faster than we allow — one moment.
          </p>
        ) : game.answering ? (
          // The tap is locked but the server has not confirmed it yet — say
          // what is actually happening rather than claiming it is in.
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Sending your answer…
          </p>
        ) : answered ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check aria-hidden className="size-4 text-primary" />
            Answer locked in
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Timer aria-hidden className="size-4" />
            Pick one — the faster you answer, the more it scores.
          </p>
        )}
      </div>

      {revealed &&
        state.game.settings.show_leaderboard &&
        (state.game.players?.length ?? 0) > 0 && (
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
            <StageKicker>Leaderboard</StageKicker>
            <div className="mt-2">
              <Leaderboard
                players={state.game.players ?? []}
                viewerUuid={viewerUuid}
                limit={5}
              />
            </div>
          </div>
        )}
    </GameStage>
  );
}

/** The reader's own result — the only place `is_correct` may be rendered, and
 *  only once the server has revealed it. */
function RevealResult({
  state,
  standing,
  isPlaying,
}: {
  state: QuizGameState;
  standing: AnswerStanding;
  isPlaying: boolean;
}) {
  const answer = state.your_answer;

  if (!isPlaying) return <WatchingNote />;

  if (!answer) {
    // NOTHING IN THE READ IS NOT THE SAME AS NOTHING SENT. An answer the server
    // took but this read has not caught up with holds the row's shape; a tap
    // whose fate we never learned says exactly that; only a reader who really
    // sent nothing is told they sent nothing.
    if (standing.kind === 'answered') {
      return <Skeleton className="h-6 w-40 rounded" />;
    }
    return (
      <p className="text-sm text-muted-foreground">
        {standing.kind === 'unknown'
          ? "We never heard back about your answer — the scores have the last word."
          : 'No answer from you this time.'}
      </p>
    );
  }

  // The shared half of a reveal can arrive by broadcast before the per-viewer
  // half is read back (points are never broadcast) — so the row holds its
  // shape and fills in, rather than flashing a wrong verdict.
  if (answer.is_correct === undefined) {
    return <Skeleton className="h-6 w-40 rounded" />;
  }

  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
        // `emerald-700` in light, not the app's habitual `emerald-600`: this
        // is TEXT on a tinted chip and 600 lands under 4.5:1 there. Dark keeps
        // 400, which passes comfortably. (See the module docblock — the
        // house-wide emerald audit is a phase-6 token job, not this wave's.)
        answer.is_correct
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {answer.is_correct ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <X aria-hidden className="size-4" />
      )}
      {answer.is_correct ? 'Correct' : 'Not this time'}
      {answer.is_correct && answer.points !== undefined && (
        <span className="tabular-nums">+{answer.points.toLocaleString()}</span>
      )}
    </p>
  );
}

function WatchingNote() {
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Eye aria-hidden className="size-4" />
      You&rsquo;re watching this one — you can play the next game.
    </p>
  );
}

/* ── The last question, when the game ended instead of revealing it ───────── */

/**
 * THE ENDING THE WIRE DOES NOT SEND.
 *
 * A question closes the moment every eligible player has answered. On the LAST
 * question that means the game goes straight from `question_open` to
 * `finished`: `current_question` becomes `null`, no reveal is ever published,
 * and a player who has just answered would learn only their total score —
 * never whether the answer they just gave was right. Measured in production on
 * 2026-08-04; it is the normal path, not an edge case.
 *
 * NOTHING HERE IS INVENTED. This screen joins two things the server did send:
 *  - the question as the screen last held it (its text and its options), and
 *    what the server says this reader did with it ({@link AnswerStanding}) —
 *    a receipt or a `your_answer`, never an assumption that a tap became an
 *    answer, and never "you didn't answer" when the truth is "we never
 *    learned";
 *  - the finished game's results, whose per-question stats carry the correct
 *    option, the room's distribution and the no-answer count.
 * Their equality is the verdict. There is no fabricated reveal payload, no
 * guessed points (the results publish no per-question score, so this says
 * nothing about points), and if the results cannot be read it says that
 * plainly and moves on.
 *
 * IT CONTINUES THE QUESTION RATHER THAN REPLACING IT. The kicker, the question
 * and the four tiles stay exactly where they were — the reader's pick still
 * gold — and resolve into the verdict when the results land, so there is no
 * skeleton flash and no second screen to re-read. Then the podium, on its own,
 * after `FINAL_ANSWER_HOLD_MS` (`./model.ts`) or the moment the reader asks.
 *
 * THE ANSWERING RAIL DOES NOT COME WITH IT, deliberately. The arrival list was
 * captured from the last state read BEFORE the game ended — and on this
 * question, the reader's own answer is usually what ended it — so it would be
 * one name short of the room while presenting itself as the whole of it. The
 * results' distribution below the tiles is the complete version of the same
 * fact, and it is right there.
 */
export function FinalAnswerStage({
  closing,
  gameUuid,
  viewerId,
  isPlaying,
  onContinue,
}: {
  closing: FinalAnswerClose;
  gameUuid: string;
  viewerId: number | null;
  isPlaying: boolean;
  onContinue: () => void;
}) {
  const query = useQuery(channelQuizQueries.results({ gameUuid, viewerId }));
  const question = closing.question.question;
  const stats =
    query.data?.data.questions.find((row) => row.uuid === question.uuid) ?? null;

  const standing = closing.standing;
  const myPick = standing.kind === 'answered' ? standing.optionId : null;
  const correctId = stats?.correct_option.id ?? null;
  const picks = stats ? totalPicks(stats.option_counts, stats.no_answer_count) : 0;
  const countFor = (optionId: number) =>
    stats?.option_counts.find((entry) => entry.option_id === optionId)?.count;

  return (
    <GameStage>
      <div className="flex flex-col gap-3">
        <StageKicker>Last question</StageKicker>
        <PhaseRow>
          <Trophy aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="text-sm text-muted-foreground">
            That answer ended the game — final scores next
          </span>
        </PhaseRow>
      </div>

      <h2 className="text-xl leading-snug font-semibold text-balance text-foreground sm:text-2xl">
        {question.question}
      </h2>

      <div
        className={cn('grid gap-3', question.options.length > 2 && 'sm:grid-cols-2')}
      >
        {question.options.map((option, index) => {
          const count = countFor(option.id);
          return (
            <OptionTile
              key={option.id}
              index={index}
              content={option.content}
              state={optionState(option.id, myPick, correctId)}
              share={stats && picks > 0 ? (count ?? 0) / picks : undefined}
              count={stats ? (count ?? 0) : undefined}
              disabled
            />
          );
        })}
      </div>

      <div className="flex min-h-10 flex-wrap items-center gap-3">
        {!isPlaying ? (
          <WatchingNote />
        ) : query.isPending ? (
          // The verdict is the one thing not yet known — hold its shape.
          <Skeleton className="h-6 w-40 rounded" />
        ) : stats ? (
          <VerdictChip
            standing={standing}
            correct={myPick !== null && myPick === correctId}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            We couldn&rsquo;t read how this question went — the final scores are
            next.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={onContinue}>
          See final scores
        </Button>
      </div>
    </GameStage>
  );
}

/** Right, wrong, never sent, or never confirmed — the same four sentences the
 *  reveal uses, minus the points, which nothing published for this question. */
function VerdictChip({
  standing,
  correct,
}: {
  standing: AnswerStanding;
  correct: boolean;
}) {
  if (standing.kind !== 'answered') {
    return (
      <p className="text-sm text-muted-foreground">
        {standing.kind === 'unknown'
          ? "We never heard back about your last answer — the final scores below have it either way."
          : 'No answer from you this time.'}
      </p>
    );
  }
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
        // `emerald-700` in light — see RevealResult for why.
        correct
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {correct ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <X aria-hidden className="size-4" />
      )}
      {correct ? 'Correct' : 'Not this time'}
    </p>
  );
}

/* ── Podium ───────────────────────────────────────────────────────────────── */

const PODIUM_HEIGHT = ['h-24', 'h-16', 'h-12'];
const PODIUM_ORDER = [1, 0, 2];

export function PodiumStage({
  gameUuid,
  viewerId,
  viewerUuid,
}: {
  gameUuid: string;
  viewerId: number | null;
  viewerUuid: string | null;
}) {
  const query = useQuery(channelQuizQueries.results({ gameUuid, viewerId }));
  const results = query.data?.data;

  if (query.isPending) {
    return (
      <GameStage>
        <div aria-hidden className="flex items-end justify-center gap-3 pt-8">
          {PODIUM_HEIGHT.map((height, index) => (
            <Skeleton key={index} className={cn('w-20 rounded-t-lg', height)} />
          ))}
        </div>
        <Skeleton className="mx-auto h-4 w-40 rounded" />
      </GameStage>
    );
  }

  if (query.isError || !results) {
    // TWO DIFFERENT TRUTHS, AND THEY MUST NOT SHARE A SENTENCE. A `409` is the
    // server's answer — this game was cancelled or is somehow still running, so
    // there are no scores and there never will be. Anything else is a failed
    // read of scores that DO exist, and telling that reader their game kept no
    // scores would be a lie with no way back from it.
    const refused = extractApiError(query.error).status === 409;
    return (
      <GameStage>
        <CollabMessage
          icon={refused ? Trophy : WifiOff}
          tone={refused ? 'neutral' : 'alert'}
          title={
            refused
              ? 'No final scores for this game'
              : "Couldn't load the final scores"
          }
          description={
            refused
              ? 'Results are kept for games that ran to the end. A game that was cancelled leaves none.'
              : 'The scores are safe on our side — this screen just lost touch with them.'
          }
          action={
            refused ? undefined : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
              >
                Try again
              </Button>
            )
          }
        />
      </GameStage>
    );
  }

  const podium = results.podium;
  const ordered = PODIUM_ORDER.map((index) => podium[index]).filter(
    (row): row is QuizRankingRow => row !== undefined,
  );

  // What the share card should SAY depends on where this reader finished, and
  // both facts are already on screen. A viewer absent from the ranking watched
  // rather than played — the host who never answered, or a member who opened
  // the results afterwards — and is asked for the share on different grounds.
  const leader = results.ranking.find((row) => row.rank === 1) ?? null;
  const viewerRow =
    viewerUuid === null
      ? null
      : (results.ranking.find((row) => row.user.uuid === viewerUuid) ?? null);
  const standing: QuizShareStanding =
    viewerRow === null
      ? { outcome: 'watched', leader: leader?.user.name ?? null }
      : viewerRow.rank === 1
        ? { outcome: 'won' }
        : { outcome: 'played', leader: leader?.user.name ?? null };

  return (
    <GameStage>
      <div className="text-center">
        <StageKicker>Final scores</StageKicker>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">
          {results.game.quiz.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {results.game.player_count}{' '}
          {results.game.player_count === 1 ? 'player' : 'players'} ·{' '}
          {results.game.question_count}{' '}
          {results.game.question_count === 1 ? 'question' : 'questions'}
        </p>
      </div>

      {ordered.length > 0 && (
        <div className="flex items-end justify-center gap-3 pt-4">
          {ordered.map((row) => (
            <div key={row.user.uuid} className="flex w-24 flex-col items-center gap-2">
              <PlayerChip user={row.user} />
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {row.score.toLocaleString()}
              </span>
              <div
                className={cn(
                  'v2-quiz-rise w-full rounded-t-lg border-t border-x',
                  PODIUM_HEIGHT[row.rank - 1] ?? 'h-10',
                  row.rank === 1
                    ? 'border-primary/40 bg-primary/20'
                    : 'border-border bg-secondary',
                )}
                style={{ animationDelay: `${(row.rank - 1) * 90}ms` }}
              >
                <span className="sr-only">Rank {row.rank}</span>
                <span
                  aria-hidden
                  className="flex h-full items-start justify-center pt-2 text-sm font-semibold text-muted-foreground"
                >
                  {row.rank}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SHARING SITS WHERE THE THING WORTH SHARING JUST APPEARED — directly
          under the podium, before the full ranking. Any player may hand the
          link out: everyone on this screen already sees more than the public
          card publishes, so gating it to the host would protect nothing. */}
      <ShareResults
        gameUuid={gameUuid}
        standing={standing}
        quizTitle={results.game.quiz.title}
      />

      <div>
        <StageKicker>Everyone</StageKicker>
        <ol className="mt-2 flex flex-col gap-1">
          {results.ranking.map((row) => (
            <RankRow
              key={row.user.uuid}
              rank={row.rank}
              user={row.user}
              score={row.score}
              detail={rankingDetail(row)}
              isViewer={row.user.uuid === viewerUuid}
            />
          ))}
        </ol>
      </div>

      {results.questions.length > 0 && (
        <div>
          <StageKicker>How the room did</StageKicker>
          <ul className="mt-2 flex flex-col gap-2">
            {results.questions.map((question) => (
              <li
                key={question.uuid}
                className="rounded-lg border bg-card px-3 py-2.5"
              >
                <p className="text-sm text-foreground">{question.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Math.round(question.percent_correct)}% got it ·{' '}
                  {/* Text, so `emerald-700` in light — see RevealResult. */}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {question.correct_option.content}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GameStage>
  );
}

/* ── Cancelled ────────────────────────────────────────────────────────────── */

export function CancelledStage({
  cancelledBy,
  onBack,
}: {
  cancelledBy: SlimUser | null;
  onBack: () => void;
}) {
  return (
    <GameStage>
      <CollabMessage
        icon={Ban}
        tone="neutral"
        title="This game was cancelled"
        description={
          cancelledBy
            ? `${cancelledBy.name} ended the game before it finished. Cancelled games keep no scores.`
            : 'The game ended before it finished — cancelled games keep no scores.'
        }
        action={
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to the channel
          </Button>
        }
      />
    </GameStage>
  );
}
