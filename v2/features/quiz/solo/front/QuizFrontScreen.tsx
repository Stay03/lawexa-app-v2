'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import { VisibilityChip } from '@/v2/features/channels/quiz/VisibilityChip';
import { LawexaMark, MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { ShareButton } from '@/v2/features/sharing/ShareButton';
import { VisibilityOption } from '@/v2/features/sharing/VisibilityOption';
import { useV2Session } from '@/v2/runtime/session-context';
import { signInHref } from '@/v2/runtime/sign-in-href';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
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
 * taken is a quiz half-spoiled. The front says how many and how long; the
 * player shows them one at a time.
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
      <div className={LIST_COLUMN}>
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

  return (
    <div className={LIST_COLUMN}>
      <article className="flex flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <header className="space-y-3">
          <h1 className="text-2xl leading-snug font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            {quiz.title}
          </h1>
          {quiz.description && (
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {quiz.description}
            </p>
          )}
          {/* Whose, how many, how long — and, for the owner, who can find it.
              `creator` is nullable (a gone account): a word, never a crash. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MemberAvatar user={quiz.creator} size="sm" />
              <span className="truncate">
                {own ? 'You wrote this' : (quiz.creator?.name ?? 'Someone who has left')}
              </span>
            </span>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span className="shrink-0">{questionCountLabel(count)}</span>
            {questions.length > 0 && (
              <>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <span className="shrink-0">{quizLengthLabel(questions)}</span>
              </>
            )}
            {quiz.is_ai_generated && (
              <span className="inline-flex items-center gap-1">
                <LawexaMark className="size-3 shrink-0" />
                drafted by Lawexa
              </span>
            )}
            {own && <VisibilityChip visibility={quiz.visibility} />}
          </div>
        </header>

        <section aria-labelledby="quiz-reveal-heading" className="space-y-2">
          <h2 id="quiz-reveal-heading" className="text-sm font-medium text-foreground">
            When do you want to see the answers?
          </h2>
          <div
            role="group"
            aria-labelledby="quiz-reveal-heading"
            className="grid gap-2 sm:grid-cols-2"
          >
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
          <div className="flex flex-wrap items-center gap-3">
            {mayTake ? (
              <Button size="lg" onClick={start} disabled={startAttempt.isPending}>
                {startAttempt.isPending ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Play aria-hidden className="size-4" />
                )}
                Start quiz
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href={signInHref(pathname)}>Sign in to take this quiz</Link>
              </Button>
            )}
            {shareable && (
              <ShareButton
                path={quizFrontHref(quiz.uuid)}
                title={quiz.title}
                label="Share this quiz"
              />
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
      </article>

      {/* The owner's edit, from the bar's menu. No channel: the quiz's home is
          fixed, and the form reads the entry this screen already holds. */}
      <QuizFormDialog
        key={formOpenings}
        open={formOpen}
        onOpenChange={setFormOpen}
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
      <div aria-hidden inert className={LIST_COLUMN}>
        <QuizFrontSkeleton />
      </div>
    </>
  );
}
