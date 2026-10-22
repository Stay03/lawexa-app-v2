'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDayLabel } from '@/lib/utils/collab';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { DeleteQuizDialog } from '@/v2/features/channels/quiz/DeleteQuizDialog';
import { QuizFormDialog } from '@/v2/features/channels/quiz/QuizFormDialog';
import { VisibilityChip } from '@/v2/features/channels/quiz/VisibilityChip';
import { VisibilityGroup } from '@/v2/features/channels/quiz/VisibilityGroup';
import { LawexaMark } from '@/v2/features/channels/ui/avatars';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { useV2Session } from '@/v2/runtime/session-context';
import { CREATE_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import { canPublishPublicly, questionCountLabel, quizFrontHref } from '../model';
import { soloQuizQueries } from '../queries';

/**
 * LibraryScreen — `/quiz/library`, every quiz this account wrote.
 *
 * ── THE SAME QUIZZES THE CHANNEL SHEET'S LIBRARY TAB LISTS, AS A PAGE ──────
 * A quiz belongs to the person who wrote it and merely RUNS in channels
 * (backend, 2026-08-05), and since 2026-10-21 it can be taken alone and found
 * by link. The sheet shows the first thirty for "what can I run here?"; this
 * page scrolls through all of them for "what have I written?", and each row
 * opens the quiz's own front (`/quiz/q/{uuid}`), where it is taken or shared.
 *
 * ── THE ROW'S MENU IS THE OWNER'S, ALWAYS ──────────────────────────────────
 * Every row here is `is_mine` by the endpoint's definition, so every row
 * carries the visibility switch (`VisibilityGroup`, the one the sheet uses),
 * Share where a link can open the quiz (`link` or `public`; the same share
 * behaviour as the pill on the quiz front, `useShareAction`), Edit and
 * Delete. Nothing is gated on a channel's host policy: a library is not a
 * room.
 *
 * ── ROWS ARE THE LIST GRAMMAR ──────────────────────────────────────────────
 * The `SessionRow` shape: one honest link per row, a hairline between rows,
 * the loudest line first and a quiet meta line in two zones (what it is on
 * the left, when it was written right-anchored). The menu trigger is a
 * SIBLING of the link, never nested in it.
 *
 * ── THE SENTINEL IS ROOTED IN THE SHELL, NOT THE VIEWPORT ──────────────────
 * Same reasoning as the quiz history: the list lives inside the shell's one
 * scroll container, so the observer is handed that scroller.
 */
export function LibraryScreen() {
  const session = useV2Session();
  const { userId: viewerId } = session;
  const canPublish = canPublishPublicly(session);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | undefined>(undefined);
  /** Bumped on every OPENING of the form, and used as its `key` — the house
   *  dialog contract (`use-url-overlay.ts`): mounted through its close so the
   *  exit plays, keyed so every arrival is a fresh mount. */
  const [formOpenings, setFormOpenings] = useState(0);
  const [deleting, setDeleting] = useState<ChannelQuiz | null>(null);

  const query = useInfiniteQuery(soloQuizQueries.library({ viewerId }));

  const pages = query.data?.pages;
  const quizzes = useMemo<ChannelQuiz[]>(
    () => pages?.flatMap((page) => page.data) ?? [],
    [pages],
  );

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const openForm = useCallback((quizUuid?: string) => {
    setEditingUuid(quizUuid);
    setFormOpenings((openings) => openings + 1);
    setFormOpen(true);
  }, []);
  // One stable pair for every row, so `LibraryRow`'s `memo` holds when the
  // list re-renders (a page loading under the sentinel, a refetch).
  const editQuiz = useCallback((quiz: ChannelQuiz) => openForm(quiz.uuid), [openForm]);
  const deleteQuiz = useCallback((quiz: ChannelQuiz) => setDeleting(quiz), []);

  const showSkeleton = query.isPending;
  const showError = query.isError && quizzes.length === 0;
  const showEmpty = !showSkeleton && !showError && quizzes.length === 0;

  return (
    <div className={LIST_COLUMN}>
      <LibraryHeading onCreate={() => openForm()} />

      {/* The ONE live region for this surface: the skeleton is `aria-hidden`
          and the route fallback's announcement is gone by the time an in-page
          fetch happens. */}
      <span role="status" aria-live="polite" className="sr-only">
        {showSkeleton ? 'Loading your quizzes' : ''}
      </span>

      {showSkeleton ? (
        <LibraryListSkeleton />
      ) : showError ? (
        <QuizErrorState
          title="Couldn't load your quizzes"
          description="Your quizzes are still there — the list just did not load."
          onRetry={() => void query.refetch()}
        />
      ) : showEmpty ? (
        <QuizMessage
          icon={ClipboardList}
          tone="accent"
          title="You haven't written a quiz yet"
          description="A quiz is a few timed questions. Take it yourself, run it in a channel you host in, or share it by link."
          action={
            <Button size="sm" onClick={() => openForm()}>
              <Plus aria-hidden className="size-4" />
              Write your first quiz
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border/60">
            {quizzes.map((quiz, index) => (
              <LibraryRow
                key={quiz.uuid}
                quiz={quiz}
                index={index}
                canPublish={canPublish}
                onEdit={editQuiz}
                onDelete={deleteQuiz}
              />
            ))}
          </ul>

          <div ref={sentinelRef} className="pt-1">
            {query.isFetchingNextPage ? (
              <LibraryNextPageSkeleton />
            ) : !query.hasNextPage && quizzes.length > 5 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/70">
                No more quizzes
              </p>
            ) : null}
          </div>
        </>
      )}

      {/* No channel: the form can only file into the library. Keyed per
          opening and mounted through its close — see `openForm`. */}
      <QuizFormDialog
        key={formOpenings}
        open={formOpen}
        onOpenChange={setFormOpen}
        viewerId={viewerId}
        quizUuid={editingUuid}
      />

      <DeleteQuizDialog quiz={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

/** Static chrome — identical in the live screen and in the route fallback. */
function LibraryHeading({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        {/* ONE TITLE PER SCREEN, AT EVERY WIDTH: the bar carries "My quizzes"
            below `md:` (`pushed-route.ts`), so the heading is stated for
            assistive tech everywhere and drawn only from `md:` up. */}
        <h1 className="sr-only md:not-sr-only md:text-xl md:font-semibold md:tracking-tight md:text-foreground">
          My quizzes
        </h1>
        <p className="text-sm text-muted-foreground">
          Quizzes you wrote. Take one yourself, run it in a channel, or share
          it by link.
        </p>
      </div>
      <button type="button" onClick={onCreate} className={cn(CREATE_PILL, FOCUS_RING)}>
        <Plus aria-hidden className="size-4" />
        New quiz
      </button>
    </div>
  );
}

/**
 * One quiz the reader wrote. `memo` because the list can grow past a page and
 * the sentinel re-renders the list on every one.
 */
const LibraryRow = memo(function LibraryRow({
  quiz,
  index,
  canPublish,
  onEdit,
  onDelete,
}: {
  quiz: ChannelQuiz;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  canPublish: boolean;
  /** Stable across renders (the list's `useCallback`s), so the `memo` holds. */
  onEdit: (quiz: ChannelQuiz) => void;
  onDelete: (quiz: ChannelQuiz) => void;
}) {
  const count = quiz.question_count ?? quiz.questions?.length ?? 0;
  /** The visibility switch's refusal, said under the row it was pressed on.
   *  There are no toasts on this surface and the write is `silentError`. */
  const [refusal, setRefusal] = useState<string | null>(null);
  const shareable = quiz.visibility === 'link' || quiz.visibility === 'public';
  const share = useShareAction({ path: quizFrontHref(quiz.uuid), title: quiz.title });

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="flex items-center gap-1">
        <Link
          href={quizFrontHref(quiz.uuid)}
          className={cn(
            'v2-interactive group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
            FOCUS_RING,
          )}
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:text-foreground"
          >
            <ClipboardList className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-[15px] font-medium text-foreground transition-colors group-hover:text-primary sm:line-clamp-1">
              {quiz.title}
            </span>
            <span className="mt-1 flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
              {/* LEAD — what it is: the count, who can find it, and whether
                  Lawexa drafted it. The chip is the one thing that may give. */}
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="shrink-0">{questionCountLabel(count)}</span>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <VisibilityChip visibility={quiz.visibility} />
                {quiz.is_ai_generated && (
                  <span className="hidden min-w-0 items-center gap-1 sm:inline-flex">
                    <LawexaMark className="size-3 shrink-0" />
                    <span className="truncate">drafted by Lawexa</span>
                  </span>
                )}
              </span>
              {/* TRAIL — when, right-anchored so the dates read straight down
                  the list. */}
              <span className="shrink-0 tabular-nums">
                {formatDayLabel(quiz.created_at)}
              </span>
            </span>
          </span>
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
          />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={`Options for ${quiz.title}`}
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <VisibilityGroup quiz={quiz} canPublish={canPublish} onRefused={setRefusal} />
            <DropdownMenuSeparator />
            {/* Only where a link can open it: sharing a private quiz's address
                would hand out a 404. The chip above the menu says why. */}
            {shareable && (
              <DropdownMenuItem onClick={() => void share.share()}>
                <Share2 aria-hidden className="size-4" />
                Share
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(quiz)}>
              <Pencil aria-hidden className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(quiz)}>
              <Trash2 aria-hidden className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {refusal && (
        <p
          role="alert"
          className="px-2 pb-3 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {refusal}
        </p>
      )}
      {/* The menu has closed by the time the clipboard answers, so the row
          says it — for a reader who cannot see it too. */}
      {share.copied && !refusal && (
        <p
          role="status"
          className="px-2 pb-3 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          Link copied
        </p>
      )}
    </li>
  );
});

/** One skeleton row at `LibraryRow`'s geometry: tile, two text lines, menu. */
function LibraryRowSkeleton() {
  return (
    <div className="flex items-center gap-1">
      <div className="flex min-h-11 flex-1 items-center gap-3 px-2 py-3">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/5 rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-2/5 rounded" />
            <Skeleton className="ml-auto h-3 w-12 shrink-0 rounded" />
          </div>
        </div>
      </div>
      <Skeleton className="size-9 shrink-0 rounded-full" />
    </div>
  );
}

/** The initial-load skeleton — progressive opacity down the stack, the one
 *  loading language every v2 list speaks. It pulses in the route fallback too. */
export function LibraryListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}>
          <LibraryRowSkeleton />
        </div>
      ))}
    </div>
  );
}

function LibraryNextPageSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <LibraryRowSkeleton />
      <div style={{ opacity: 0.5 }}>
        <LibraryRowSkeleton />
      </div>
    </div>
  );
}

/**
 * The library route's fallback (`app/v2/quiz/(solo)/library/loading.tsx`): the
 * SAME heading, drawn for real, over the row skeleton, so route boundary →
 * live list is one continuous shape.
 */
export function LibraryFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your quizzes
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <LibraryHeading onCreate={() => undefined} />
        <LibraryListSkeleton />
      </div>
    </>
  );
}
