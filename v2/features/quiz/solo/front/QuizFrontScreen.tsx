'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Compass,
  Eye,
  ListChecks,
  Loader2,
  Pencil,
  Play,
  SearchX,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import type { ChannelQuiz, QuizRevealMode } from '@/types/channel-quiz';
import { DeleteQuizDialog } from '@/v2/features/channels/quiz/DeleteQuizDialog';
import { SPEED_SCORING_NOTE } from '@/v2/features/channels/quiz/model';
import { QuizFormDialog } from '@/v2/features/channels/quiz/QuizFormDialog';
import { channelQuizQueries } from '@/v2/features/channels/quiz/queries';
import { VISIBILITY_MARKS } from '@/v2/features/channels/quiz/VisibilityChip';
import { visibilityFace } from '@/v2/features/channels/quiz/model';
import { LawexaMark, MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { ShareButton } from '@/v2/features/sharing/ShareButton';
import { VisibilityOption } from '@/v2/features/sharing/VisibilityOption';
import { useV2Session } from '@/v2/runtime/session-context';
import { signInHref } from '@/v2/runtime/sign-in-href';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { QuizTile } from '../QuizTile';
import { bestLabel, quizMinutesLabel, scenarioCountLabel } from '../rows-model';
import { quizContents, takenLabel } from './front-model';
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
 * ── NOTHING HERE LISTS THE QUESTIONS ───────────────────────────────────────
 * The preview carries them (without answers), but a quiz read before it is
 * taken is a quiz half-spoiled. The front says how many and how long, and
 * "What is in it" names only the scenarios and how many questions each has
 * (`quizContents`), until Arthur answers "the first 2 questions, or all"
 * (Stay, 23 October 2026). The player shows the questions one at a time.
 *
 * ── THE APPROVED DESIGN (quiz piece 3, picture 4) ──────────────────────────
 * A masthead (the tile, the title, the author, the facts as pills), then a
 * panel with the reader's best and how often they took it, the reveal choice
 * and Start. On a computer the two sit side by side; on a phone Start stays
 * at the foot of the screen.
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

  const [revealMode, setRevealMode] = useState<QuizRevealMode>(DEFAULT_REVEAL_MODE);
  const startAttempt = useStartAttempt(quizUuid, viewerId);
  /** A refusal of Start, said under the button — this surface has no toasts. */
  const [startError, setStartError] = useState<string | null>(null);

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
  const contents = quizContents(questions, quiz.scenarios ?? []);
  const Mark = VISIBILITY_MARKS[quiz.visibility];

  return (
    <div className={FRONT_COLUMN}>
      <article className="grid gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-start md:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
          <header className="space-y-3">
            <QuizTile uuid={quiz.uuid} title={quiz.title} className="size-14 rounded-[18px] text-xl" />
            <h1 className="text-2xl leading-snug font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
              {quiz.title}
            </h1>
            {/* Whose. `creator` is nullable (a gone account): a word, never a crash. */}
            <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <MemberAvatar user={quiz.creator} size="sm" />
              <span className="truncate font-medium text-foreground/85">
                {own ? 'You wrote this' : (quiz.creator?.name ?? 'Someone who has left')}
              </span>
              {quiz.is_ai_generated && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <LawexaMark className="size-3 shrink-0" />
                  drafted by Lawexa
                </span>
              )}
            </p>
            {quiz.description && (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{quiz.description}</p>
            )}
            {/* What it is, as pills that wrap whole, never cut. */}
            <ul className="flex flex-wrap gap-2" aria-label="About this quiz">
              <FactPill>{questionCountLabel(count)}</FactPill>
              {scenarios ? <FactPill>{scenarios}</FactPill> : null}
              {minutes ? <FactPill>{minutes}</FactPill> : null}
              {own ? (
                <FactPill>
                  <Mark aria-hidden className="size-3.5 shrink-0" />
                  {visibilityFace(quiz.visibility)}
                </FactPill>
              ) : null}
            </ul>
          </header>

          {contents.length > 0 ? (
            <section aria-labelledby="quiz-contents-heading" className="space-y-2">
              <h2 id="quiz-contents-heading" className="text-sm font-medium text-foreground">
                What is in it
              </h2>
              <ul className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/60">
                {contents.map((line) => (
                  <li key={line.key} className="px-4 py-3 text-sm text-foreground/90">
                    {line.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5 md:rounded-3xl md:border-2 md:border-border md:bg-card md:p-5">
          {best || taken ? (
            <div className="flex items-end justify-between gap-3 rounded-2xl border-2 border-border bg-card p-4 md:border-0 md:bg-transparent md:p-0">
              {best ? (
                <div>
                  <div className="text-xs text-muted-foreground">Your best</div>
                  <div className="font-comfortaa text-2xl font-bold text-primary tabular-nums">
                    {best.replace(/^Best /, '')}
                  </div>
                </div>
              ) : (
                <span />
              )}
              {taken ? <div className="text-sm font-medium text-foreground/85">{taken}</div> : null}
            </div>
          ) : null}

          <section aria-labelledby="quiz-reveal-heading" className="space-y-2">
            <h2 id="quiz-reveal-heading" className="text-sm font-medium text-foreground">
              When do you want to see the answers?
            </h2>
            <div role="group" aria-labelledby="quiz-reveal-heading" className="grid gap-2">
              {REVEAL_MODE_CHOICES.map((choice) => (
                <VisibilityOption
                  key={choice.id}
                  icon={choice.id === 'each' ? Eye : ListChecks}
                  title={choice.label}
                  description={choice.hint}
                  selected={revealMode === choice.id}
                  busy={false}
                  onSelect={() => setRevealMode(choice.id)}
                />
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3">
            {/* START STAYS IN REACH: pinned to the foot of a phone's screen over
                the same see-through plate the results use; in the panel on a
                computer. */}
            <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border/60 bg-background/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/70 md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              {mayTake ? (
                <Button size="lg" className="min-w-0 flex-1" onClick={start} disabled={startAttempt.isPending}>
                  {startAttempt.isPending ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Play aria-hidden className="size-4" />
                  )}
                  Start quiz
                </Button>
              ) : (
                <Button asChild size="lg" className="min-w-0 flex-1">
                  <Link href={signInHref(pathname)}>Sign in to take this quiz</Link>
                </Button>
              )}
              {shareable && (
                <ShareButton path={quizFrontHref(quiz.uuid)} title={quiz.title} label="Share this quiz" />
              )}
            </div>

            {!mayTake && (
              <p className="text-sm text-muted-foreground">
                Anyone can browse quizzes. Taking one keeps your score on your
                account —{' '}
                <Link
                  href="/register"
                  className={cn('rounded text-foreground underline underline-offset-4', FOCUS_RING)}
                >
                  create a free account
                </Link>
                .
              </p>
            )}

            {own && !shareable && (
              <p className="text-sm text-muted-foreground">
                {quiz.visibility === 'private'
                  ? 'Only you can open this quiz. Change who can find it to share it by link.'
                  : 'This quiz is shared with the channels it has run in. Change who can find it to share it by link.'}
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

            <p className="text-xs text-muted-foreground/80">{SPEED_SCORING_NOTE}</p>
          </div>
        </div>
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
const FRONT_COLUMN = 'mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:pt-6 md:pb-16';

/** One fact about the quiz, as a pill that wraps whole. */
function FactPill({ children }: { children: React.ReactNode }) {
  return (
    <li className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 text-xs whitespace-nowrap text-foreground/85">
      {children}
    </li>
  );
}

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
