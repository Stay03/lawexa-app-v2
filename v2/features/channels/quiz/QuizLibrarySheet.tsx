'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Library,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Radio,
  Sparkles,
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
import type { ChannelQuiz, ChannelQuizVisibility } from '@/types/channel-quiz';
import type { Channel } from '@/types/collab';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { TabRow } from '@/v2/shell/TabRow';
import { canManageChannel } from '../model';
import { MemberAvatar } from '../ui/avatars';
import { useHeldValue } from '../use-held-value';
import { useDeleteQuiz, useGoLive, useSetQuizVisibility } from './mutations';
import {
  canHostQuiz,
  goLiveTarget,
  HOST_POLICY_LIBRARY_NOTE,
  HOST_POLICY_REFUSAL,
  VISIBILITY_CHOICES,
  VISIBILITY_FOOTNOTE,
} from './model';
import { channelQuizQueries } from './queries';
import { QuizFormDialog } from './QuizFormDialog';

/**
 * QuizLibrarySheet — the quizzes a reader can reach from this room: the ones
 * that have been HERE, and the ones that are THEIRS.
 *
 * Phase-5 W6; rebuilt 2026-08-05 for the backend's ownership split. Sources:
 * `docs/api/channel-quiz.md` (backend repo), `api-digest.md` §C/§E. A SHEET
 * over the transcript, like pins and saves (design-research DIRECTION 14:
 * lenses over the channel, never a second place to live) — a quiz is something
 * you reach for mid-conversation and put back.
 *
 * ── TWO SOURCES, ONE SHEET (2026-08-05) ────────────────────────────────────
 * A quiz now belongs to the person who wrote it and is merely RUN in a channel,
 * so "the channel's quizzes" stopped being the whole answer. The sheet asks two
 * questions and lets the reader switch between them:
 *
 *  - IN THIS CHANNEL (the default, because it is where the reader is standing):
 *    `GET /channels/{c}/quizzes`, whose meaning changed the same day — written
 *    here OR played here at least once. Other people's rows appear here, and a
 *    row whose owner has since made it private does not.
 *  - MY LIBRARY: `GET /channel-quizzes/mine`, every quiz this reader authored,
 *    including ones no channel has ever seen.
 *
 * They are one strip, not a list with a second list bolted under it, because
 * they are two ANSWERS to one question — "what can I run here?" — and the rows,
 * the affordances and the empty states are the same object either way.
 *
 * THE OLD "Mine" FILTER IS GONE and the library replaced it: it asked the same
 * thing in one room, which is strictly less useful than asking it everywhere.
 *
 * ── RUNNING ONE RUNS IT *HERE* ─────────────────────────────────────────────
 * Pressing Go live inside a channel means "run this in this channel", so the
 * room is context and there is no picker. `goLiveTarget` builds the body; the
 * quiz's own `channel_uuid` is PROVENANCE and is never treated as a
 * destination, a link or a name. It can be null (a quiz written straight into a
 * library) and the room it names can be gone (`channel_deleted`) — so nothing
 * here says where a quiz came from, only what it is.
 *
 * NEITHER IS `creator` SAFE TO DEREFERENCE. It is null once that account is
 * gone, exactly like a message author, and reading `creator.name` here took the
 * whole channel screen down on a live channel on 2026-08-05.
 *
 * ONE LIVE GAME PER CHANNEL is a server rule, so the sheet leads with it: when
 * a game is already running, the top of the list says so and offers the way in,
 * and a go-live that races another host's 409 lands on that same banner rather
 * than on an error. Nobody has to read a status code to understand what
 * happened.
 *
 * ── THREE DIFFERENT PERMISSIONS, NOT ONE ───────────────────────────────────
 *  - THE HOST POLICY (`settings.quiz_host_policy`) governs who may CREATE a
 *    quiz FOR this channel and who may START a game in it. It says nothing
 *    about a reader's own library, which is not the room's — so the Library tab
 *    keeps its New quiz button and says plainly that a game still needs a
 *    channel admin.
 *  - AUTHORSHIP (`is_mine`, the server's own answer) governs editing, deleting
 *    and the visibility switch.
 *  - CHANNEL GOVERNANCE also grants edit/delete, but ONLY over a quiz that was
 *    written in this channel. That was always the rule; it just used to be the
 *    only kind of quiz a channel list could hold. A library quiz that has
 *    merely been PLAYED here belongs to its author and to no room, so a channel
 *    admin is offered nothing on it — the affordance is hidden where it is
 *    confidently refused, never shown where it is confidently allowed.
 */

const SOURCES = [
  { id: 'room', label: 'In this channel' },
  { id: 'library', label: 'My library' },
] as const;

type SourceId = (typeof SOURCES)[number]['id'];

export function QuizLibrarySheet({
  channel,
  viewerId,
  open,
  onOpenChange,
  onOpenGame,
}: {
  channel: Channel;
  viewerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hands a game uuid back to the channel screen, which owns the game mode. */
  onOpenGame: (gameUuid: string) => void;
}) {
  const [source, setSource] = useState<SourceId>('room');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | undefined>(undefined);
  /** Which source the open form is writing into — captured when it opens, so
   *  switching tabs behind a dialog cannot move the quiz being written. */
  const [formSource, setFormSource] = useState<SourceId>('room');
  /** Bumped on every OPENING of the form, and used as its `key`. The dialog is
   *  mounted through its close (Radix Presence never plays an exit for a
   *  component that unmounts in the same commit — the house dialog contract,
   *  `use-url-overlay.ts`), so this is what still gives every arrival a fresh
   *  mount with its fields re-derived from the quiz it was opened on. */
  const [formOpenings, setFormOpenings] = useState(0);
  const [deleting, setDeleting] = useState<ChannelQuiz | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const mayHost = canHostQuiz(channel);

  const roomQuery = useQuery({
    ...channelQuizQueries.quizzes({ channelUuid: channel.uuid, viewerId }),
    enabled: open,
  });
  const libraryQuery = useQuery({
    ...channelQuizQueries.myQuizzes({ viewerId }),
    // The library is fetched only once the reader asks for it: a sheet opened
    // to check what is running here should not pull a second list nobody
    // looked at.
    enabled: open && source === 'library',
  });
  const activeQuery = useQuery({
    ...channelQuizQueries.activeGame({ channelUuid: channel.uuid, viewerId }),
    enabled: open,
  });

  const listQuery = source === 'room' ? roomQuery : libraryQuery;
  const liveGame = activeQuery.data?.data?.[0] ?? null;
  const quizzes = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const governs = canManageChannel(channel);
  /** Creating from the Library tab is nobody's to refuse; creating FOR this
   *  channel is the host policy's. */
  const mayCreateHere = source === 'library' || mayHost;

  /* WHY THE REFUSAL IS NOT CLEARED ON `liveGame === null`. It used to be, and
     that made all three of its sentences unreachable: the button below is only
     pressable while `liveGame` is null, so the render that cleared the message
     always followed the render that set it. A reader whose go-live was refused
     — by the 409 that means another host got there first, by the 403 the host
     policy raises, or by anything else the server had to say — watched the
     spinner stop, saw nothing change, and pressed again. There are no toasts on
     these surfaces and the mutation is `silentError`, so this line was the whole
     answer.

     It is cleared where clearing is honest instead: a fresh attempt wipes it
     (`onLiveRefused(null)` below), opening the live game wipes it, and closing
     the sheet wipes it so a refusal never outlives the visit that earned it. */

  const openForm = (quizUuid?: string) => {
    setEditingUuid(quizUuid);
    setFormSource(source);
    setFormOpenings((openings) => openings + 1);
    setFormOpen(true);
  };

  // NOTE: this sheet does NOT close itself on the way into a game. The screen
  // closes it, because closing is now a history move: dismissing this sheet
  // pops the entry it was opened on, and a `?game=` push issued in the same
  // handler would land on that doomed entry and be undone. `ChannelScreen`'s
  // `openGame` closes the panel IN PLACE first, then pushes.

  /** The refusal, held through the sheet's own exit. `liveError` is cleared the
   *  moment the sheet is told to close (below), and a message that vanished
   *  while the panel was still sliding away would read as a glitch — so what is
   *  RENDERED falls back to the last sentence once the sheet is no longer open,
   *  while an open sheet always shows the live value and can therefore still
   *  clear it instantly for a fresh attempt. */
  const heldLiveError = useHeldValue(liveError);
  const shownLiveError = open ? liveError : heldLiveError;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          // A refusal belongs to the visit that earned it; it must not be
          // waiting the next time the sheet is opened.
          if (!next) setLiveError(null);
          onOpenChange(next);
        }}
      >
        <SheetContent
          side="right"
          /* VARIANT-MATCHED WIDTH, or these are dead classes. The Sheet
             primitive sets its own size with `data-[side=right]:w-3/4` and
             `data-[side=right]:sm:max-w-sm`, and an attribute selector outranks
             a bare utility on specificity — so the plain `w-full sm:max-w-lg`
             that used to be here lost silently, and this sheet has been
             rendering at three quarters of a phone screen and 384px on a
             desktop. That missing quarter is most of why its rows were
             truncating a quiz title at seventeen characters. Same trap, same
             remedy, as `V2Drawer` and `SpaceDrawer`. */
          className="flex flex-col data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        >
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
                onClick={() => {
                  // Taking the way in answers the refusal, so the sentence
                  // explaining it has nothing left to say.
                  setLiveError(null);
                  onOpenGame(liveGame.uuid);
                }}
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

            {shownLiveError && (
              <p
                role="alert"
                className="text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                {shownLiveError}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              {/* THE STRIP SCROLLS, IT NEVER WRAPS — the radar/bookmarks
                  mechanic (`overflow-x-auto` on the tablist itself), not a
                  fifth answer. `min-w-0` is what makes it work: a flex child
                  cannot shrink past its own content without it, and with
                  nothing to shrink there was nothing to scroll — so "In this
                  channel" and "My library" broke onto two lines INSIDE their
                  own tabs and the strip read as three uneven blocks. Now the
                  labels are `whitespace-nowrap`, each tab holds its width, and
                  the row that runs out of space scrolls.

                  `-m-1 p-1` IS THE FOCUS RING'S ROOM, ON ALL FOUR SIDES. An
                  `overflow-x-auto` box clips its own padding edge in both axes,
                  and Radix moves focus to the first tab when the sheet opens —
                  so with vertical room only, the ring on a tab sitting flush at
                  the left edge lost its left and top and drew as a broken
                  bracket, which reads as a rendering fault rather than focus.
                  The negative margin gives the room back, so the strip's
                  position and height are unchanged. */}
              <TabRow
                tabs={SOURCES}
                value={source}
                onChange={(next) => setSource(next)}
                ariaLabel="Which quizzes to show"
                className="v2-quiet-scroll -m-1 flex min-w-0 items-center gap-4 overflow-x-auto p-1"
                tabClassName={(selected) =>
                  cn(
                    'v2-interactive relative flex min-h-9 shrink-0 items-center rounded-none',
                    'text-sm font-medium whitespace-nowrap',
                    'transition-colors duration-150 motion-reduce:transition-none',
                    selected
                      ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {(item) => item.label}
              </TabRow>

              {mayCreateHere && (
                <Button size="sm" className="shrink-0" onClick={() => openForm()}>
                  <Plus aria-hidden className="size-4" />
                  New quiz
                </Button>
              )}
            </div>

            {/* The host policy, said in the words of whichever tab is open. */}
            {!mayHost && (
              <p className="text-xs text-muted-foreground">
                {source === 'library'
                  ? HOST_POLICY_LIBRARY_NOTE
                  : HOST_POLICY_REFUSAL}
              </p>
            )}

            {listQuery.isPending ? (
              <QuizListSkeleton />
            ) : listQuery.isError ? (
              <CollabMessage
                icon={WifiOff}
                tone="alert"
                title={
                  source === 'library'
                    ? "Couldn't load your library"
                    : "Couldn't load the quizzes"
                }
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
                icon={source === 'library' ? Library : Trophy}
                tone="accent"
                title={
                  source === 'library'
                    ? 'Your library is empty'
                    : 'No quizzes here yet'
                }
                description={
                  source === 'library'
                    ? 'Your library holds the quizzes you write. They belong to you, not to a room — so you can run the same one in any channel you host in, as often as you like.'
                    : 'A quiz is a few timed questions the whole channel answers at once — good for revision, onboarding, or settling an argument.'
                }
                action={
                  mayCreateHere ? (
                    <Button size="sm" onClick={() => openForm()}>
                      <Plus aria-hidden className="size-4" />
                      Write the first one
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {quizzes.map((quiz) => (
                    <QuizRow
                      key={quiz.uuid}
                      quiz={quiz}
                      channelUuid={channel.uuid}
                      mayHost={mayHost}
                      // Governance reaches a quiz that was WRITTEN here and
                      // nothing else — see the module docblock.
                      mayManage={
                        quiz.is_mine ||
                        (governs && quiz.channel_uuid === channel.uuid)
                      }
                      hasLiveGame={liveGame !== null}
                      onEdit={() => openForm(quiz.uuid)}
                      onDelete={() => setDeleting(quiz)}
                      onLive={onOpenGame}
                      onLiveRefused={setLiveError}
                    />
                  ))}
                </ul>
                {/* The list is one page deep. Saying so is cheaper than a
                    "Show more" nobody asked for, and far cheaper than letting a
                    reader believe a 31st quiz does not exist. */}
                {total > quizzes.length && (
                  <p className="text-xs text-muted-foreground">
                    Showing the {quizzes.length} most recent of {total}.
                  </p>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* MOUNTED THROUGH ITS CLOSE, keyed per opening. Mounting it behind
          `formOpen &&` while also handing it `open={formOpen}` put the close and
          the unmount in the same commit, so Radix Presence never got a frame to
          play the exit and the dialog simply vanished. The key is what still
          gives every ARRIVAL a fresh mount with its fields re-derived from the
          quiz it was opened on — the house dialog contract, stated at
          `use-url-overlay.ts`. It fetches nothing while closed (its detail query
          is `enabled: open && isEdit`), so standing mounted costs no request. */}
      <QuizFormDialog
        key={formOpenings}
        open={formOpen}
        onOpenChange={setFormOpen}
        channelUuid={channel.uuid}
        channelName={channel.name}
        destination={formSource === 'library' ? 'library' : 'channel'}
        viewerId={viewerId}
        quizUuid={editingUuid}
      />

      <DeleteQuizDialog quiz={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function QuizRow({
  quiz,
  channelUuid,
  mayHost,
  mayManage,
  hasLiveGame,
  onEdit,
  onDelete,
  onLive,
  onLiveRefused,
}: {
  quiz: ChannelQuiz;
  channelUuid: string;
  /** The channel's host policy: may this viewer put a quiz live HERE? */
  mayHost: boolean;
  /** Authorship, or governance over a quiz written in this channel. */
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
  const isPrivate = quiz.visibility === 'private';

  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-3">
      <div className="min-w-0 flex-1">
        {/* AT A NARROW WIDTH THE ROW'S HEIGHT GIVES, NOT THE TITLE. Go live and
            the overflow trigger are a fixed 126px whatever the row says, and a
            phone that hands the title what is left was cutting it to "Land
            registratio…" — a quiz the reader cannot identify is a row they
            cannot use. The width the sheet was actually rendering at is fixed
            above and returns most of that room; a second line covers the rest,
            rather than dropping the words off the one verb on the row. One line
            again from `sm`, where the column is wide enough that a second was
            only ever going to be a ragged half-line. */}
        <p className="line-clamp-2 text-sm font-medium text-foreground sm:line-clamp-1">
          {quiz.title}
        </p>
        {/* ONE LINE THAT GIVES IN A DECIDED ORDER, never a wrapped one.

            It used to be `flex-wrap` around a `truncate` span carrying all
            three facts and no `min-w-0` — the one thing a truncating flex child
            cannot go without, because its automatic minimum is otherwise its
            whole content. So the span could not shrink, wrapped to a row of its
            own, and left the avatar stranded alone on the line above it: at
            phone width on every row, at desktop width on most of them.

            Nothing wraps now, and the order of surrender is explicit. THE DATE
            GOES FIRST, whole rather than as a stub — a date cut to "Y…" tells a
            reader strictly less than no date at all, and of the three facts it
            is the one they are least likely to have come for. THEN THE AUTHOR
            truncates, which at least still names a person. THE QUESTION COUNT
            NEVER GIVES: it is the fact that says what the quiz is. */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {/* No `className`: the mark is already `shrink-0` from the Avatar
              primitive, and the `size-4` that used to ride here was a dead
              class — `data-[size=sm]:size-6` outranks a bare `size-4` on
              specificity, so this has always drawn at the `sm` size it asks
              for. Stating the size twice, once wrongly, is worse than stating
              it once. */}
          <MemberAvatar user={quiz.creator} size="sm" />
          {/* NOTHING HERE NAMES A ROOM. `quiz.channel_uuid` is where the quiz
              was born, not where it is being read, and the room may since have
              been deleted (`channel_deleted`) — so a quiz is described by what
              it IS (how many questions, whose, when) and never by where it
              came from. */}
          <span className="shrink-0">
            {count} {count === 1 ? 'question' : 'questions'}
          </span>
          {/* `creator` IS NULLABLE AND THIS LINE PROVED IT. Reading
              `creator.name` here crashed the whole channel screen on a live
              channel (2026-08-05) — the account had gone, the wire sent null,
              and our type said it could not. A missing author is a designed
              word now, never a dereference. */}
          <span className="min-w-0 truncate">
            ·{' '}
            {quiz.is_mine
              ? 'you'
              : (quiz.creator?.name ?? 'Someone who has left')}
          </span>
          {/* Lawexa wrote the questions; the person above still owns it. Said
              once, quietly, because "who made this" is the honest answer to a
              row you are about to run for a whole room. */}
          {quiz.is_ai_generated && (
            <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
              <Sparkles aria-hidden className="size-3 shrink-0 text-primary" />
              <span className="truncate">drafted by Lawexa</span>
            </span>
          )}
          {/* Dropped exactly where the sheet stops being the whole screen:
              below `sm` it is viewport-wide, and the narrowest phone this ships
              to has no room for a "Sunday, August 3" beside a name. Tied to the
              same breakpoint as the sheet's own `sm:max-w-lg` so the two can
              never disagree about which sheet this is. */}
          <span className="hidden shrink-0 sm:inline">
            · {formatDayLabel(quiz.created_at)}
          </span>
          {/* The switch's state, legible without opening the menu. Owner-only,
              because nobody else can see a private quiz in the first place.

              IT IS THE ONE THING HERE BESIDES THE NAME THAT CAN GIVE, and it
              has to be: on the narrowest phone the avatar, the question count
              and this chip alone are wider than the column, so if every one of
              them held its width the line would spill sideways over the Go live
              button — which is worse than the wrap it replaced. The lock never
              shrinks, so the mark survives whatever happens to the words. */}
          {quiz.is_mine && isPrivate && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5">
              <Lock aria-hidden className="size-3 shrink-0" />
              <span className="truncate">Only me</span>
            </span>
          )}
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
                goLive.mutate(goLiveTarget(channelUuid), {
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

          {/* …authorship (or governance over a quiz born here) governs
              changing one, and authorship ALONE governs who can find it. */}
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
              <DropdownMenuContent align="end" className="w-72">
                {quiz.is_mine && (
                  <>
                    <VisibilityGroup quiz={quiz} />
                    <DropdownMenuSeparator />
                  </>
                )}
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

/**
 * WHO CAN FIND THIS QUIZ — the owner's switch, and the sentence that keeps it
 * honest.
 *
 * The copy does the work `visibility` actually does and no more: it changes
 * whose LISTS the quiz appears on. It does not retract a game, hide a lobby,
 * withdraw a result or unpost a card, and the footnote says so in the same
 * breath as the choice rather than in a help article nobody opens.
 *
 * The write is optimistic with a real rollback (see `useSetQuizVisibility`),
 * because the menu closes on the press and the row is the only feedback left.
 * A refusal is not silent: the row snaps back to what the server still says.
 */
function VisibilityGroup({ quiz }: { quiz: ChannelQuiz }) {
  const setVisibility = useSetQuizVisibility(quiz.uuid);

  return (
    <>
      <DropdownMenuLabel>Who can find it</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={quiz.visibility}
        onValueChange={(value) =>
          setVisibility.mutate(value as ChannelQuizVisibility)
        }
      >
        {VISIBILITY_CHOICES.map((choice) => (
          <DropdownMenuRadioItem
            key={choice.id}
            value={choice.id}
            className="items-start"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm text-foreground">{choice.label}</span>
              <span className="text-xs text-muted-foreground">
                {choice.hint}
              </span>
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <p className="px-3 pt-1 pb-2 text-xs text-muted-foreground/80">
        {VISIBILITY_FOOTNOTE}
      </p>
    </>
  );
}

function DeleteQuizDialog({
  quiz,
  onClose,
}: {
  quiz: ChannelQuiz | null;
  onClose: () => void;
}) {
  /** The quiz this dialog is ABOUT, held through its own exit (the house
   *  primitive, same as the composer's reply bar). `quiz` goes null the instant
   *  the delete succeeds or the reader cancels, and the heading is written from
   *  it — so without this the title read "Delete ?" for the length of the fade,
   *  which is the last thing a destructive confirmation should say on its way
   *  out. It also keeps the mutation pointed at a stable uuid across that frame. */
  const shown = useHeldValue(quiz);
  const deleteQuiz = useDeleteQuiz(shown?.uuid ?? '');
  const [error, setError] = useState<string | null>(null);
  /** The refusal held through the same exit, for the same reason the title is:
   *  it is cleared on close, so a dialog dismissed after a failed delete would
   *  drop its explanation a frame before it finished fading. An OPEN dialog
   *  always reads the live value, so pressing Delete again clears it at once. */
  const heldError = useHeldValue(error);
  const shownError = quiz !== null ? error : heldError;

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
          <AlertDialogTitle>Delete {shown?.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            The quiz goes away for everyone, in every channel it has run in.
            Games already played keep their results.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {shownError && <p className="text-sm text-destructive">{shownError}</p>}
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
                      ? 'This quiz is live right now — end the game first, then it can be deleted.'
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
