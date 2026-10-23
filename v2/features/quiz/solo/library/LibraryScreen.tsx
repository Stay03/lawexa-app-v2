'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { DeleteQuizDialog } from '@/v2/features/channels/quiz/DeleteQuizDialog';
import { QuizFormDialog } from '@/v2/features/channels/quiz/QuizFormDialog';
import { VisibilityGroup } from '@/v2/features/channels/quiz/VisibilityGroup';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { useV2Session } from '@/v2/runtime/session-context';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import { canPublishPublicly, quizFrontHref } from '../model';
import { QUIZ_CARD_GRID, QuizCard, QuizCardGridSkeleton } from '../QuizCard';
import { soloQuizQueries } from '../queries';

/**
 * LibraryList — the Quiz home's My quizzes tab (`/quiz?tab=mine`), every
 * quiz this account wrote. It was the `/quiz/library` page until the home
 * became two tabs (Stay, 23 October 2026); that address now lands here. The
 * create and edit form belongs to the home (`useQuizForm`), because New quiz
 * sits on the tabs line, outside this list.
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
 * ── SMALL CARDS, TWO ACROSS ON A PHONE ─────────────────────────────────────
 * The grid Stay picked (version C, 23 October 2026), the same card Explore
 * uses (`QuizCard`): tile, title, the one fact line, the reader's best. Who
 * can take it and when it was edited left the card; the menu's visibility
 * switch says the first, and the card is the quiz, not its history. The menu
 * trigger is a SIBLING of the card's link, never nested in it.
 *
 * ── THE SENTINEL IS ROOTED IN THE SHELL, NOT THE VIEWPORT ──────────────────
 * Same reasoning as the quiz history: the list lives inside the shell's one
 * scroll container, so the observer is handed that scroller.
 */
export function LibraryList({ openForm }: { openForm: (quizUuid?: string) => void }) {
  const session = useV2Session();
  const { userId: viewerId } = session;
  const canPublish = canPublishPublicly(session);

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

  // One stable pair for every card, so `LibraryCard`'s `memo` holds when the
  // list re-renders (a page loading under the sentinel, a refetch).
  const editQuiz = useCallback((quiz: ChannelQuiz) => openForm(quiz.uuid), [openForm]);
  const deleteQuiz = useCallback((quiz: ChannelQuiz) => setDeleting(quiz), []);

  const showSkeleton = query.isPending;
  const showError = query.isError && quizzes.length === 0;
  const showEmpty = !showSkeleton && !showError && quizzes.length === 0;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Quizzes you wrote. Take one yourself, run it in a channel, or share it
        by link.
      </p>

      {/* The ONE live region for this tab: the skeleton is `aria-hidden`
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
          <ul className={QUIZ_CARD_GRID}>
            {quizzes.map((quiz, index) => (
              <LibraryCard
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

      <DeleteQuizDialog quiz={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

/**
 * The create and edit form for the reader's own quizzes, with no channel, so
 * it can only file into the library. `openForm()` writes a new quiz,
 * `openForm(uuid)` edits one; `dialog` is mounted once by the home.
 *
 * Keyed per OPENING and mounted through its close — the house dialog contract
 * (`use-url-overlay.ts`): the exit plays, and every arrival is a fresh mount.
 */
export function useQuizForm(viewerId: number | null) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | undefined>(undefined);
  const [formOpenings, setFormOpenings] = useState(0);

  const openForm = useCallback((quizUuid?: string) => {
    setEditingUuid(quizUuid);
    setFormOpenings((openings) => openings + 1);
    setFormOpen(true);
  }, []);

  const dialog = (
    <QuizFormDialog
      key={formOpenings}
      open={formOpen}
      onOpenChange={setFormOpen}
      viewerId={viewerId}
      quizUuid={editingUuid}
    />
  );

  return { openForm, dialog };
}

/**
 * One quiz the reader wrote, as a card with the owner's menu. `memo` because
 * the list can grow past a page and the sentinel re-renders it on every one.
 */
const LibraryCard = memo(function LibraryCard({
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
  /** The visibility switch's refusal, said on the card it was pressed on.
   *  There are no toasts on this surface and the write is `silentError`. */
  const [refusal, setRefusal] = useState<string | null>(null);
  const shareable = quiz.visibility === 'link' || quiz.visibility === 'public';
  const share = useShareAction({ path: quizFrontHref(quiz.uuid), title: quiz.title });

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
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
  );

  return (
    <QuizCard quiz={quiz} index={index} signedIn menu={menu}>
      {refusal && (
        <p
          role="alert"
          className="text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {refusal}
        </p>
      )}
      {/* The menu has closed by the time the clipboard answers, so the card
          says it — for a reader who cannot see it too. */}
      {share.copied && !refusal && (
        <p
          role="status"
          className="text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          Link copied
        </p>
      )}
    </QuizCard>
  );
});

/** The initial-load skeleton, in the card grid's shape. It pulses in the
 *  route fallback too. */
export function LibraryListSkeleton() {
  return <QuizCardGridSkeleton />;
}

function LibraryNextPageSkeleton() {
  return (
    <div className="pt-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <QuizCardGridSkeleton cards={4} />
    </div>
  );
}
