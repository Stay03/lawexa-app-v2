'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Check,
  Compass,
  Info,
  Loader2,
  Pencil,
  Play,
  SearchX,
  Share2,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import type { ChannelQuiz, QuizRevealMode } from '@/types/channel-quiz';
import { DeleteQuizDialog } from '@/v2/features/channels/quiz/DeleteQuizDialog';
import { QuizFormDialog } from '@/v2/features/channels/quiz/QuizFormDialog';
import { channelQuizQueries } from '@/v2/features/channels/quiz/queries';
import { VISIBILITY_MARKS } from '@/v2/features/channels/quiz/VisibilityChip';
import { visibilityFace } from '@/v2/features/channels/quiz/model';
import { MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { useV2Session } from '@/v2/runtime/session-context';
import { signInHref } from '@/v2/runtime/sign-in-href';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FrontBoard, FrontBoardSkeleton } from '../board/FrontBoard';
import { quizSubjectLabel, rankLabel } from '../home-model';
import { bestLabel, quizMinutesLabel, scenarioCountLabel } from '../rows-model';
import { FRONT_SCORING_NOTE, frontChallengeText, takenLabel } from './front-model';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenAction,
} from '@/v2/shell/screen-context';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import {
  attemptHref,
  canTakeQuiz,
  DEFAULT_REVEAL_MODE,
  EXPLORE_HREF,
  LIBRARY_HREF,
  questionCountLabel,
  quizFrontHref,
  quizLengthLabel,
  readsPreview,
  REVEAL_MODE_CHOICES,
} from '../model';
import { useStartAttempt } from '../mutations';
import { RaisedButton } from '../ui';
import '../solo-quiz.css';
import { soloQuizQueries } from '../queries';

/**
 * QuizFrontScreen — `/quiz/q/{uuid}`, the quiz's own page: what it is, who
 * wrote it, how the answers will be shown, and the one button that starts it.
 *
 * ── TWO READS, ONE SCREEN (Arthur's option B, 21 October 2026) ─────────────
 * An ACCOUNT reads the authenticated detail (`channelQuizQueries.quizDetail`:
 * it says `is_mine`, and carries `is_correct` for the author, so Edit opens on
 * the very entry this screen holds). A visitor or a guest reads the public
 * PREVIEW, the only read the server answers for them, which serves a `link` or
 * `public` quiz and `404`s everything else. Both arrive as the same shape, so
 * one body renders both; only the door at the bottom differs — Start for an
 * account, the sign-in door for everyone else, returning here afterwards.
 *
 * ── THE REVEAL CHOICE IS MADE HERE, BEFORE THE CLOCK STARTS ────────────────
 * "After each question" or "At the end" is a property of the ATTEMPT the
 * server creates (`reveal_mode`), so it is chosen on this page and sent with
 * Start; the player then simply does what the attempt says. The choice cards
 * are the sharing feature's, because they are the same object: two ways, one
 * taken, said in a sentence each.
 *
 * ── THE OWNER'S EDIT AND DELETE RIDE THE BAR'S MENU ────────────────────────
 * Published through `screen-context`, like a folder's or a space's, so this
 * screen never grows a second kebab under a bar that already has one. Delete
 * leaves the reader on their library, because this page no longer exists.
 *
 * ── A PUBLIC QUIZ SHOWS ITS LEADERBOARD ────────────────────────────────────
 * Under the masthead (Arthur, 27 October 2026): a podium of the top three on
 * B1's raised blocks, then places 4 to 10, the reader's row marked "You" and
 * added at the foot when they are further down (`FrontBoard`). The reader's
 * own rank also sits under their best in the start panel. The board is read
 * only for a `public` quiz: every other quiz's board is a `404`.
 *
 * ── NOTHING HERE LISTS THE QUESTIONS ───────────────────────────────────────
 * The preview carries them (without answers), but a quiz read before it is
 * taken is a quiz half-spoiled. The front says how many questions and
 * scenarios and how long, in its one line of facts; the "What is in it" list
 * went (Stay, 24 October 2026: "so many unnecessary text"). The player shows
 * the questions one at a time, each scenario with its source.
 *
 * ── THE APPROVED DESIGN (quiz piece 3, picture 4) ──────────────────────────
 * A masthead (the title, the author, the facts; no letter tile since
 * Arthur's 27 October brief: "prioritise the quiz, Start Quiz, Challenge a
 * Friend"), then a panel with the reader's best and how often they took it,
 * the reveal choice, Start and Challenge a friend. On a computer the two sit
 * side by side and the panel stays in view while the board scrolls; on a
 * phone Start stays at the foot of the screen.
 */
export function QuizFrontScreen({ quizUuid }: { quizUuid: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? quizFrontHref(quizUuid);
  const session = useV2Session();
  const { userId: viewerId } = session;
  const preview = readsPreview(session);
  const mayTake = canTakeQuiz(session);

  const detailQuery = useQuery({
    ...channelQuizQueries.quizDetail(quizUuid, { viewerId }),
    enabled: !preview,
  });
  const previewQuery = useQuery({
    ...soloQuizQueries.preview(quizUuid, { viewerId }),
    enabled: preview,
    // A visitor's guest pass changes the key (null to the guest's id) and the
    // cache guard clears the cache on that edge; the quiz already on screen
    // stays while it re-reads, so the front never drops back to its skeleton.
    placeholderData: keepPreviousData,
  });
  const query = preview ? previewQuery : detailQuery;
  const quiz = query.data?.data ?? null;

  const boardQuery = useQuery({
    ...soloQuizQueries.leaderboard(quizUuid, { viewerId }),
    enabled: quiz?.visibility === 'public',
  });
  const board = quiz?.visibility === 'public' ? (boardQuery.data?.data ?? null) : null;

  const [revealMode, setRevealMode] = useState<QuizRevealMode>(DEFAULT_REVEAL_MODE);
  const startAttempt = useStartAttempt(quizUuid, viewerId);
  /** A refusal of Start, said under the button — this surface has no toasts. */
  const [startError, setStartError] = useState<string | null>(null);

  // "Challenge a friend" (Arthur, 24 October 2026): the quiz's link with a
  // line to beat. Called up here with the other hooks; it runs only on a tap,
  // once the quiz is on screen.
  const challenge = useShareAction({
    path: quizFrontHref(quizUuid),
    title: query.data?.data?.title ?? null,
    text: frontChallengeText(query.data?.data?.title ?? null, query.data?.data?.viewer_best_points ?? null),
  });

  const [formOpen, setFormOpen] = useState(false);
  /** Bumped on every opening, the form's `key` (the house dialog contract). */
  const [formOpenings, setFormOpenings] = useState(0);
  const [deleting, setDeleting] = useState<ChannelQuiz | null>(null);

  const own = quiz?.is_mine === true;
  const openEdit = useCallback(() => {
    setFormOpenings((openings) => openings + 1);
    setFormOpen(true);
  }, []);
  // `?edit=1` opens the form once, for its owner: the chat's quiz card links
  // here with it (quiz from a source, 23 October 2026). Adopted in render, the
  // same once-only pattern the form uses for a loaded quiz; the parameter goes
  // when the form closes, so a refresh does not open it again.
  const wantsEdit = useSearchParams().get('edit') === '1';
  const [editAdopted, setEditAdopted] = useState(false);
  if (wantsEdit && own && !editAdopted) {
    setEditAdopted(true);
    setFormOpenings((openings) => openings + 1);
    setFormOpen(true);
  }
  const onFormOpenChange = (next: boolean) => {
    setFormOpen(next);
    if (!next && wantsEdit) replaceUrlParams({ edit: null });
  };
  const openDelete = useCallback(() => setDeleting(quiz), [quiz]);
  /** The owner's rows for the bar's overflow menu. Stable while the quiz is,
   *  so the publish below is a no-op between loads. */
  const actions = useMemo<readonly ScreenAction[]>(
    () =>
      own
        ? [
            { id: 'edit', label: 'Edit quiz', icon: Pencil, onSelect: openEdit },
            {
              id: 'delete',
              label: 'Delete quiz',
              icon: Trash2,
              destructive: true,
              onSelect: openDelete,
            },
          ]
        : [],
    [own, openEdit, openDelete],
  );
  useEffect(() => {
    setScreenContext({ pathname, back: null, actions });
  }, [pathname, actions]);
  useEffect(() => () => clearScreenContext(), []);

  const start = () => {
    setStartError(null);
    startAttempt.mutate(revealMode, {
      onSuccess: (response) => router.push(attemptHref(response.data.uuid)),
      onError: (error) => {
        const { status, message } = extractApiError(error);
        // The session ended under us: the client leaves this public page
        // alone on a 401, so the screen takes the reader to sign in itself.
        if (status === 401) {
          router.push(signInHref(pathname));
          return;
        }
        setStartError(message);
      },
    });
  };

  if (query.isPending) {
    return (
      <div className={FRONT_COLUMN}>
        <QuizFrontSkeleton />
      </div>
    );
  }

  if (query.isError || !quiz) {
    // A private quiz, a `shared` one read without membership, and an unknown
    // uuid are ONE `404` on both reads — so one honest sentence for all three.
    const notFound = extractApiError(query.error).status === 404;
    return (
      <div className={LIST_COLUMN}>
        {notFound ? (
          <QuizMessage
            icon={SearchX}
            title="We couldn't find this quiz"
            description="It may be private, it may have been deleted, or the link may be wrong."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={EXPLORE_HREF}>
                  <Compass aria-hidden className="size-4" />
                  Explore quizzes
                </Link>
              </Button>
            }
          />
        ) : (
          <QuizErrorState
            title="Couldn't load this quiz"
            description="Something went wrong on our side. Please try again."
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }

  const questions = quiz.questions ?? [];
  const count = quiz.question_count ?? questions.length;
  const shareable = quiz.visibility === 'link' || quiz.visibility === 'public';
  const scenarios = scenarioCountLabel(quiz.scenario_count ?? quiz.scenarios?.length);
  const minutes = quizMinutesLabel(quiz.total_seconds) ?? (questions.length > 0 ? quizLengthLabel(questions) : null);
  const best = bestLabel(quiz.viewer_best_points);
  const taken = takenLabel(quiz.viewer_attempts_count);
  const Mark = VISIBILITY_MARKS[quiz.visibility];
  const facts = [questionCountLabel(count), scenarios, minutes].filter((fact): fact is string => Boolean(fact));
  const subject = quizSubjectLabel(quiz);
  const rank = board?.viewer ? rankLabel(board.viewer.rank, board.player_count) : null;

  return (
    <div className={cn(FRONT_COLUMN, !mayTake && shareable && 'max-md:pb-44')}>
      {/* Three cells (Arthur, 27 October 2026: "the quiz, Start and Challenge
          first"): on a phone the quiz, then your best and Start, then the
          board; on a computer the board sits under the quiz and the panel
          holds the right column beside both. */}
      <article className="grid gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-start md:gap-x-8 md:gap-y-5">
        <div className="min-w-0 md:col-start-1 md:row-start-1">
          <header className="space-y-2 md:space-y-3">
            <h1 className="text-xl leading-snug font-semibold tracking-tight text-balance text-foreground md:text-3xl">
              {quiz.title}
            </h1>
            {/* What it is, in one line on a computer (Arthur, 24 October 2026):
                whose (the author's photo and name, for the author too), how
                many questions, how long, and who can find it. On a phone the
                author has the first line and the facts the second, so a
                wrapped line never starts with a separator. `creator` is
                nullable (a gone account): a word, never a crash. */}
            <div className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-x-1.5" aria-label="About this quiz">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MemberAvatar user={quiz.creator} size="sm" />
                <span className="truncate font-medium text-foreground/85">{quiz.creator?.name ?? 'Someone who has left'}</span>
              </span>
              <span aria-hidden className="hidden md:inline">·</span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {[...facts, null].map((fact, index) => (
                  <span key={fact ?? 'visibility'} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    {index > 0 ? <span aria-hidden>·</span> : null}
                    {fact ?? (
                      <span className="inline-flex items-center gap-1">
                        <Mark aria-hidden className="size-3.5 shrink-0" />
                        {visibilityFace(quiz.visibility)}
                      </span>
                    )}
                  </span>
                ))}
              </span>
            </div>
            {subject ? <p className="text-sm font-medium text-foreground/75">{subject}</p> : null}
            {quiz.description && (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{quiz.description}</p>
            )}
          </header>
        </div>

        <div className="flex min-w-0 flex-col gap-5 md:sticky md:top-6 md:col-start-2 md:row-span-2 md:row-start-1 md:rounded-3xl md:border-2 md:border-border md:bg-card md:p-5">
          {best || taken ? (
            <div className="flex items-end justify-between gap-3 rounded-2xl border-2 border-border bg-card p-4 md:border-0 md:bg-transparent md:p-0">
              {best ? (
                <div>
                  <div className="text-xs text-muted-foreground">Your best</div>
                  <div className="font-comfortaa text-xl font-bold text-foreground tabular-nums">
                    {best.replace(/^Best /, '')}
                  </div>
                  {rank ? (
                    <div className="text-xs text-muted-foreground tabular-nums">Your rank {rank}</div>
                  ) : null}
                </div>
              ) : (
                <span />
              )}
              {taken ? <div className="text-sm font-medium text-foreground/85">{taken}</div> : null}
            </div>
          ) : null}

          {/* When the answers show (Arthur, 24 October 2026): a small choice,
              "After each question" by default, sent with Start. */}
          {mayTake ? (
            <div className="flex items-center justify-between gap-3">
              <label id="quiz-reveal-label" htmlFor="quiz-reveal" className="text-sm text-muted-foreground">
                Answer reveal
              </label>
              <Select value={revealMode} onValueChange={(value) => setRevealMode(value as QuizRevealMode)}>
                <SelectTrigger id="quiz-reveal" aria-labelledby="quiz-reveal-label" className="h-9 w-auto min-w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {REVEAL_MODE_CHOICES.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {/* START STAYS IN REACH: pinned to the foot of a phone's screen over
                the same see-through plate the results use; in the panel on a
                computer. */}
            <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border/60 bg-background/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/70 md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              {/* B1's bold type does not fit "Sign in to take this quiz" beside
                  "Challenge a friend" in a phone's bar: the sign-in takes the
                  whole row and the challenge, after it, fills the next
                  (Backend's picture, 24 October 2026). */}
              {mayTake ? (
                <RaisedButton className={FRONT_BUTTON} onClick={start} disabled={startAttempt.isPending}>
                  {startAttempt.isPending ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Play aria-hidden className="size-4" />
                  )}
                  Start quiz
                </RaisedButton>
              ) : (
                <RaisedButton asChild className={cn(FRONT_BUTTON, 'max-md:basis-full')}>
                  <Link href={signInHref(pathname)}>Sign in to take this quiz</Link>
                </RaisedButton>
              )}
              {shareable && (
                <RaisedButton
                  type="button"
                  tone="quiet"
                  className={cn(FRONT_BUTTON, 'flex-none max-md:[a+&]:flex-1')}
                  onClick={() => void challenge.share()}
                >
                  {challenge.copied ? <Check aria-hidden className="size-4" /> : <Share2 aria-hidden className="size-4" />}
                  <span aria-live="polite">{challenge.copied ? 'Link copied' : 'Challenge a friend'}</span>
                </RaisedButton>
              )}
            </div>

            {!mayTake && (
              <p className="text-sm text-muted-foreground">
                <Link
                  href="/register"
                  className={cn('rounded text-foreground underline underline-offset-4', FOCUS_RING)}
                >
                  Create a free account
                </Link>{' '}
                to keep your score.
              </p>
            )}

            {own && !shareable && (
              <p className="text-sm text-muted-foreground">
                {quiz.visibility === 'private'
                  ? 'Only you can open this quiz.'
                  : 'Shared with the channels it has run in.'}
              </p>
            )}

            {startError && (
              <p
                role="alert"
                className="text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                {startError}
              </p>
            )}

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground/80">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{FRONT_SCORING_NOTE}</span>
            </p>
          </div>
        </div>

        {quiz.visibility === 'public' ? (
          <div className="min-w-0 md:col-start-1 md:row-start-2">
            {board ? <FrontBoard board={board} /> : boardQuery.isPending ? <FrontBoardSkeleton /> : null}
          </div>
        ) : null}
      </article>

      {/* The owner's edit, from the bar's menu. No channel: the quiz's home is
          fixed, and the form reads the entry this screen already holds. */}
      <QuizFormDialog
        key={formOpenings}
        open={formOpen}
        onOpenChange={onFormOpenChange}
        viewerId={viewerId}
        quizUuid={quizUuid}
      />

      <DeleteQuizDialog
        quiz={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => router.replace(LIBRARY_HREF)}
      />

    </div>
  );
}

/** The page's column: wider than a list, for the side panel on a computer,
 *  with room at the foot of a phone for the pinned Start. The skeleton and the
 *  route fallback share it, so the hand-over moves nothing sideways. */
/* `v2-solo` carries design B1's tokens (`../solo-quiz.css`): the lip, the
 * colours, the same reading as the player and the results (Arthur's B1,
 * 24 October 2026). */
const FRONT_COLUMN = 'v2-solo mx-auto w-full max-w-5xl px-4 pt-3 pb-28 md:pt-6 md:pb-16';

/** The page's buttons on B1's lip: the results' raised pair, a size down on a
 *  phone so Start and Challenge a friend share the pinned bar. */
const FRONT_BUTTON = 'h-12 min-w-0 flex-1 px-4 text-[15px] md:h-14 md:px-5 md:text-base';

/**
 * The front's reserved shape: the masthead (title, a line, the meta row), the
 * two choice cards and the action row, at their real geometry. It pulses in
 * the route fallback too.
 */
export function QuizFrontSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4 rounded" />
        <Skeleton className="h-4 w-full max-w-prose rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-56 rounded" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-[76px] rounded-xl" />
          <Skeleton className="h-[76px] rounded-xl" style={{ opacity: 0.7 }} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-36 rounded-4xl" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

/** The route's fallback (`app/v2/quiz/q/[quizUuid]/loading.tsx`). */
export function QuizFrontFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading quiz
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={FRONT_COLUMN}>
        <QuizFrontSkeleton />
      </div>
    </>
  );
}
