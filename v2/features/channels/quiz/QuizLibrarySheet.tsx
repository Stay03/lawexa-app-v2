'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Radio,
  Trash2,
  Trophy,
  WifiOff,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import { formatDayLabel } from '@/lib/utils/collab';
import type { ChannelQuiz } from '@/types/channel-quiz';
import type { Channel } from '@/types/collab';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { TabRow } from '@/v2/shell/TabRow';
import { canManageChannel } from '../model';
import { MemberAvatar } from '../ui/avatars';
import { useDeleteQuiz, useGoLive } from './mutations';
import { canHostQuiz, HOST_POLICY_REFUSAL } from './model';
import { channelQuizQueries } from './queries';
import { QuizFormDialog } from './QuizFormDialog';

/**
 * QuizLibrarySheet — the channel's quizzes: write one, edit one, delete one,
 * and put one live.
 *
 * Phase-5 W6; sources: `docs/api/channel-quiz.md` (backend repo),
 * `api-digest.md` §C/§E. A SHEET over the transcript, like pins and saves
 * (design-research DIRECTION 14: lenses over the channel, never a second place
 * to live) — a quiz is something you reach for mid-conversation and put back.
 *
 * ONE LIVE GAME PER CHANNEL is a server rule, so the sheet leads with it: when
 * a game is already running, the top of the list says so and offers the way in,
 * and a go-live that races another host's 409 lands on that same banner rather
 * than on an error. Nobody has to read a status code to understand what
 * happened.
 *
 * THE HOST POLICY (`settings.quiz_host_policy`) hides the write affordances it
 * knows are refused and says why — but the LIST stays readable for everyone,
 * because knowing what the channel has is not a privilege the policy governs.
 *
 * TWO DIFFERENT PERMISSIONS, NOT ONE (audit M2). The policy governs who may
 * CREATE a quiz and START a game; it says nothing about who may edit or delete
 * an EXISTING one, which the server gates on authorship (or the governance
 * chain — channel owner/admin, space governor, platform admin). Under
 * `all_members` those two would collide and every member would be offered
 * Edit and Delete on everyone else's quiz, to be refused by the server. So
 * `Go live` follows the policy while the row menu follows authorship-or-
 * governance. The space-governor and platform-admin halves are invisible from
 * a channel row, so a governor sees no menu here and the server stays the
 * authority — the affordance is hidden where it is confidently refused, never
 * shown where it is confidently allowed.
 */

const FILTERS = [
  { id: 'all', label: 'All quizzes' },
  { id: 'mine', label: 'Mine' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

export function QuizLibrarySheet({
  channel,
  viewerId,
  viewerUuid,
  open,
  onOpenChange,
  onOpenGame,
}: {
  channel: Channel;
  viewerId: number | null;
  viewerUuid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hands a game uuid back to the channel screen, which owns the game mode. */
  onOpenGame: (gameUuid: string) => void;
}) {
  const [filter, setFilter] = useState<FilterId>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | undefined>(undefined);
  const [deleting, setDeleting] = useState<ChannelQuiz | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const mayHost = canHostQuiz(channel);

  const listQuery = useQuery({
    ...channelQuizQueries.quizzes({
      channelUuid: channel.uuid,
      viewerId,
      mine: filter === 'mine',
    }),
    enabled: open,
  });
  const activeQuery = useQuery({
    ...channelQuizQueries.activeGame({ channelUuid: channel.uuid, viewerId }),
    enabled: open,
  });

  const liveGame = activeQuery.data?.data?.[0] ?? null;
  const quizzes = listQuery.data?.data ?? [];
  const governs = canManageChannel(channel);

  // "A quiz is already running here" stops being true the moment it stops
  // running (audit L8). Clearing it in render keeps the sentence and the state
  // it describes in the same commit — a stale blocker over an empty channel
  // would send the reader looking for a game that ended.
  if (liveError !== null && liveGame === null) setLiveError(null);

  // NOTE: this sheet does NOT close itself on the way into a game. The screen
  // closes it, because closing is now a history move: dismissing this sheet
  // pops the entry it was opened on, and a `?game=` push issued in the same
  // handler would land on that doomed entry and be undone. `ChannelScreen`'s
  // `openGame` closes the panel IN PLACE first, then pushes.

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="gap-1 border-b">
            <SheetTitle>Quizzes</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Live group quizzes for {channel.name}. Everyone plays on their own
              device.
            </p>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
            {liveGame && (
              <button
                type="button"
                onClick={() => onOpenGame(liveGame.uuid)}
                className="v2-interactive flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-left transition-colors duration-150 hover:bg-primary/10 motion-reduce:transition-none"
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
                >
                  <Radio className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {liveGame.quiz.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Live now
                    {liveGame.player_count !== undefined &&
                      ` · ${liveGame.player_count} ${
                        liveGame.player_count === 1 ? 'player' : 'players'
                      }`}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium text-primary">
                  Open
                </span>
              </button>
            )}

            {liveError && (
              <p className="text-sm text-muted-foreground">{liveError}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <TabRow
                tabs={FILTERS}
                value={filter}
                onChange={(next) => setFilter(next)}
                ariaLabel="Filter quizzes"
                className="flex items-center gap-4"
                tabClassName={(selected) =>
                  cn(
                    'v2-interactive relative flex min-h-9 items-center rounded-none text-sm font-medium',
                    'transition-colors duration-150 motion-reduce:transition-none',
                    selected
                      ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {(item) => item.label}
              </TabRow>

              {mayHost && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingUuid(undefined);
                    setFormOpen(true);
                  }}
                >
                  <Plus aria-hidden className="size-4" />
                  New quiz
                </Button>
              )}
            </div>

            {!mayHost && (
              <p className="text-xs text-muted-foreground">
                {HOST_POLICY_REFUSAL}
              </p>
            )}

            {listQuery.isPending ? (
              <QuizListSkeleton />
            ) : listQuery.isError ? (
              <CollabMessage
                icon={WifiOff}
                tone="alert"
                title="Couldn't load the quizzes"
                description="Something went wrong on our side. Please try again."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void listQuery.refetch()}
                  >
                    Try again
                  </Button>
                }
              />
            ) : quizzes.length === 0 ? (
              <CollabMessage
                icon={Trophy}
                tone="accent"
                title={
                  filter === 'mine'
                    ? "You haven't written a quiz here"
                    : 'No quizzes here yet'
                }
                description="A quiz is a few timed questions the whole channel answers at once — good for revision, onboarding, or settling an argument."
                action={
                  mayHost ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingUuid(undefined);
                        setFormOpen(true);
                      }}
                    >
                      <Plus aria-hidden className="size-4" />
                      Write the first one
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {quizzes.map((quiz) => (
                  <QuizRow
                    key={quiz.uuid}
                    quiz={quiz}
                    channelUuid={channel.uuid}
                    mayHost={mayHost}
                    isMine={quiz.creator.uuid === viewerUuid}
                    mayManage={quiz.creator.uuid === viewerUuid || governs}
                    hasLiveGame={liveGame !== null}
                    onEdit={() => {
                      setEditingUuid(quiz.uuid);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleting(quiz)}
                    onLive={onOpenGame}
                    onLiveRefused={setLiveError}
                  />
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {formOpen && (
        <QuizFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          channelUuid={channel.uuid}
          viewerId={viewerId}
          quizUuid={editingUuid}
        />
      )}

      <DeleteQuizDialog
        channelUuid={channel.uuid}
        quiz={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function QuizRow({
  quiz,
  channelUuid,
  mayHost,
  isMine,
  mayManage,
  hasLiveGame,
  onEdit,
  onDelete,
  onLive,
  onLiveRefused,
}: {
  quiz: ChannelQuiz;
  channelUuid: string;
  /** The channel's host policy: may this viewer put a quiz live? */
  mayHost: boolean;
  isMine: boolean;
  /** Authorship or channel governance: may this viewer edit/delete THIS quiz? */
  mayManage: boolean;
  hasLiveGame: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLive: (gameUuid: string) => void;
  /** `null` clears a previous refusal. */
  onLiveRefused: (message: string | null) => void;
}) {
  const goLive = useGoLive(channelUuid, quiz.uuid);
  const count = quiz.question_count ?? quiz.questions?.length ?? 0;

  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {quiz.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MemberAvatar user={quiz.creator} size="sm" className="size-4" />
          <span className="truncate">
            {count} {count === 1 ? 'question' : 'questions'} ·{' '}
            {isMine ? 'you' : quiz.creator.name} ·{' '}
            {formatDayLabel(quiz.created_at)}
          </span>
        </div>
      </div>

      {(mayHost || mayManage) && (
        <div className="flex shrink-0 items-center gap-1">
          {/* The host policy governs starting a game… */}
          {mayHost && (
            <Button
              size="sm"
              variant="outline"
              disabled={goLive.isPending || hasLiveGame}
              title={
                hasLiveGame
                  ? 'A quiz is already running in this channel'
                  : undefined
              }
              onClick={() => {
                // A fresh attempt clears the previous refusal (audit L8) — the
                // reader must never read last try's sentence over this try's
                // spinner.
                onLiveRefused(null);
                goLive.mutate(undefined, {
                  onSuccess: (response) => onLive(response.data.uuid),
                  onError: (error) => {
                    const { status, message } = extractApiError(error);
                    onLiveRefused(
                      status === 409
                        ? 'A quiz is already running in this channel — open it above, or wait for it to finish.'
                        : status === 403
                          ? HOST_POLICY_REFUSAL
                          : message,
                    );
                  },
                });
              }}
            >
              {goLive.isPending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Play aria-hidden className="size-4" />
              )}
              Go live
            </Button>
          )}

          {/* …authorship (or channel governance) governs changing one. */}
          {mayManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Options for ${quiz.title}`}
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil aria-hidden className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 aria-hidden className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </li>
  );
}

function DeleteQuizDialog({
  channelUuid,
  quiz,
  onClose,
}: {
  channelUuid: string;
  quiz: ChannelQuiz | null;
  onClose: () => void;
}) {
  const deleteQuiz = useDeleteQuiz(channelUuid, quiz?.uuid ?? '');
  const [error, setError] = useState<string | null>(null);

  return (
    <AlertDialog
      open={quiz !== null}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {quiz?.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            The quiz goes away for everyone. Games already played keep their
            results.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteQuiz.isPending}>
            Keep it
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              deleteQuiz.mutate(undefined, {
                onSuccess: onClose,
                onError: (mutationError) => {
                  const { status, message } = extractApiError(mutationError);
                  setError(
                    status === 409
                      ? "This quiz is live right now — end the game first, then it can be deleted."
                      : message,
                  );
                },
              });
            }}
            disabled={deleteQuiz.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteQuiz.isPending && (
              <Loader2 aria-hidden className="mr-1 size-4 animate-spin" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QuizListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="rounded-xl border px-3 py-3"
          style={{ opacity: Math.max(0.3, 1 - index * 0.2) }}
        >
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
