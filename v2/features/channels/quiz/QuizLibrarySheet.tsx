'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Library,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Share2,
  Trash2,
  Trophy,
  WifiOff,
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
import { canPublishPublicly, quizFrontHref } from '@/v2/features/quiz/solo/model';
import { QuizTile } from '@/v2/features/quiz/solo/QuizTile';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { useV2Session } from '@/v2/runtime/session-context';
import { TabRow } from '@/v2/shell/TabRow';
import { canManageChannel } from '../model';
import { LawexaMark, MemberAvatar } from '../ui/avatars';
import { useHeldValue } from '../use-held-value';
import { DeleteQuizDialog } from './DeleteQuizDialog';
import { useGoLive } from './mutations';
import {
  canHostQuiz,
  HOST_POLICY_LIBRARY_NOTE,
  HOST_POLICY_REFUSAL,
  SPACE_HOST_NOTE,
} from './model';
import { channelQuizQueries } from './queries';
import { channelRoom, roomNoun, spaceRoom, type QuizRoom } from './quiz-room';
import { QuizFormDialog } from './QuizFormDialog';
import { COMPACT_RAISED, LiveQuizTile } from './ui';
import { VisibilityChip } from './VisibilityChip';
import { VisibilityGroup } from './VisibilityGroup';
import '@/v2/features/quiz/solo/solo-quiz.css';

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
 * room is context and there is no picker. `useGoLive` names it in the body; the
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
 *    keeps its Create quiz button and says plainly that a game still needs a
 *    channel admin.
 *  - AUTHORSHIP (`is_mine`, the server's own answer) governs editing, deleting
 *    and the visibility switch.
 *  - CHANNEL GOVERNANCE also grants edit/delete, but ONLY over a quiz that was
 *    written in this channel. That was always the rule; it just used to be the
 *    only kind of quiz a channel list could hold. A library quiz that has
 *    merely been PLAYED here belongs to its author and to no room, so a channel
 *    admin is offered nothing on it — the affordance is hidden where it is
 *    confidently refused, never shown where it is confidently allowed.
 *
 * ── WHO CAN FIND IT SPEAKS THE FULL VOCABULARY (2026-10-21) ────────────────
 * The switch is the shared `VisibilityGroup` — the same four answers the
 * library page and the form offer (`shared`, `private`, `link`, `public`,
 * with "Everyone" waiting on a verified author), the same words, the same
 * refusal under the row. A row wears its chip for anything but `shared`,
 * which is the room's own answer and needs no label here, and a `link` or
 * `public` quiz can be shared from its menu: the link opens the quiz's front
 * (`/quiz/q/{uuid}`), where anyone signed in can take it alone.
 *
 * ── IN THE QUIZ'S OWN LOOK (Stay and Arthur, 11 November 2026) ─────────────
 * The rows are the solo quiz's: a quiz's letter tile on a rounded-2xl card
 * with a 2px border, Go live and Create quiz the solo quiz's raised button a
 * size down (`COMPACT_RAISED`), and the live game at the top its tile with
 * the live dot. `v2-solo` sits on the sheet's content, which portals out.
 */

const SOURCES = [
  { id: 'room', label: 'In this channel' },
  { id: 'library', label: 'My library' },
] as const;

type SourceId = (typeof SOURCES)[number]['id'];

/**
 * Where the sheet hosts (live quiz in Spaces, Arthur's decisions 93142269): a
 * channel, or a Space itself. A Space has no "quizzes that have been here"
 * list, so its sheet is the reader's library alone; it is hosted by the
 * Space's Owner and Contributors (`mayHost`), and a game started from a Space
 * chat names that chat (`conversationUuid`), where its live and finished
 * lines go.
 */
export type QuizHostPlace =
  | { kind: 'channel'; channel: Channel }
  | {
      kind: 'space';
      space: { uuid: string; name: string };
      mayHost: boolean;
      conversationUuid: string | null;
    };

export function QuizLibrarySheet({
  place,
  viewerId,
  open,
  onOpenChange,
  onOpenGame,
}: {
  place: QuizHostPlace;
  viewerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hands a game uuid back to the screen, which owns the game mode. */
  onOpenGame: (gameUuid: string) => void;
}) {
  const channel = place.kind === 'channel' ? place.channel : null;
  const room: QuizRoom = channel ? channelRoom(channel.uuid) : spaceRoom(place.kind === 'space' ? place.space.uuid : '');
  const placeName = channel ? channel.name : place.kind === 'space' ? place.space.name : '';
  const conversationUuid = place.kind === 'space' ? place.conversationUuid : null;
  const [source, setSource] = useState<SourceId>(channel ? 'room' : 'library');
  /** Whether "Everyone" is live in a row's visibility switch. */
  const canPublish = canPublishPublicly(useV2Session());
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

  const mayHost = channel ? canHostQuiz(channel) : place.kind === 'space' && place.mayHost;

  const roomQuery = useQuery({
    ...channelQuizQueries.quizzes({ channelUuid: channel?.uuid ?? '', viewerId }),
    // Only a channel has a list of the quizzes that have been in it.
    enabled: open && channel !== null,
  });
  const libraryQuery = useQuery({
    ...channelQuizQueries.myQuizzes({ viewerId }),
    // The library is fetched only once the reader asks for it: a sheet opened
    // to check what is running here should not pull a second list nobody
    // looked at.
    enabled: open && source === 'library',
  });
  const activeQuery = useQuery({
    ...channelQuizQueries.activeGame({ room, viewerId }),
    enabled: open,
  });

  const listQuery = source === 'room' ? roomQuery : libraryQuery;
  const liveGame = activeQuery.data?.data?.[0] ?? null;
  const quizzes = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  // Channel governance reaches a quiz written in that channel; a Space has no such rule.
  const governs = channel ? canManageChannel(channel) : false;
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
          className="v2-solo flex flex-col data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        >
          <SheetHeader className="gap-1 border-b">
            <SheetTitle className="text-lg font-bold tracking-tight">Quizzes</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Live group quizzes for {placeName}. Everyone plays on their own
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
                className="v2-interactive flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-3 text-left transition-colors duration-150 hover:bg-primary/10 motion-reduce:transition-none"
              >
                <LiveQuizTile uuid={liveGame.quiz.uuid} title={liveGame.quiz.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
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
                <span className="shrink-0 text-sm font-bold text-[var(--solo-gold-text)]">
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
              {/* A Space has the library alone: no strip for one tab. */}
              {channel ? (
              <TabRow
                tabs={SOURCES}
                value={source}
                onChange={(next) => setSource(next)}
                ariaLabel="Which quizzes to show"
                className="v2-quiet-scroll -m-1 flex min-w-0 items-center gap-4 overflow-x-auto overscroll-x-contain p-1"
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
              ) : (
                <p className="text-sm font-medium text-foreground">My library</p>
              )}

              {mayCreateHere && (
                <RaisedButton className={cn(COMPACT_RAISED, 'shrink-0')} onClick={() => openForm()}>
                  <Plus aria-hidden className="size-4" />
                  Create quiz
                </RaisedButton>
              )}
            </div>

            {/* The host policy, said in the words of whichever tab is open. */}
            {!mayHost && (
              <p className="text-xs text-muted-foreground">
                {!channel
                  ? SPACE_HOST_NOTE
                  : source === 'library'
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
                  <RaisedButton
                    tone="quiet"
                    className={COMPACT_RAISED}
                    onClick={() => void listQuery.refetch()}
                  >
                    Try again
                  </RaisedButton>
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
                    ? 'Your library holds the quizzes you write. They belong to you, not to a room, so you can run the same one in any channel or Space you host in, as often as you like.'
                    : 'A quiz is a few timed questions the whole channel answers at once. Good for revision, onboarding, or settling an argument.'
                }
                action={
                  mayCreateHere ? (
                    <RaisedButton className={COMPACT_RAISED} onClick={() => openForm()}>
                      <Plus aria-hidden className="size-4" />
                      Write the first one
                    </RaisedButton>
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
                      room={room}
                      conversationUuid={conversationUuid}
                      refusal403={channel ? HOST_POLICY_REFUSAL : SPACE_HOST_NOTE}
                      mayHost={mayHost}
                      // Governance reaches a quiz that was WRITTEN here and
                      // nothing else — see the module docblock.
                      mayManage={
                        quiz.is_mine ||
                        (governs && channel !== null && quiz.channel_uuid === channel.uuid)
                      }
                      hasLiveGame={liveGame !== null}
                      canPublish={canPublish}
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
      {/* In a Space a new quiz files into the writer's library: there is no
          room list for it to join (QuizHostPlace). */}
      <QuizFormDialog
        key={formOpenings}
        open={formOpen}
        onOpenChange={setFormOpen}
        channelUuid={channel?.uuid}
        channelName={channel?.name}
        spaceUuid={channel ? channel.space.uuid : room.uuid}
        destination={channel && formSource !== 'library' ? 'channel' : 'library'}
        viewerId={viewerId}
        quizUuid={editingUuid}
      />

      <DeleteQuizDialog quiz={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function QuizRow({
  quiz,
  room,
  conversationUuid,
  refusal403,
  mayHost,
  mayManage,
  hasLiveGame,
  canPublish,
  onEdit,
  onDelete,
  onLive,
  onLiveRefused,
}: {
  quiz: ChannelQuiz;
  /** Where Go live runs it: the sheet's channel or Space (quiz-room.ts). */
  room: QuizRoom;
  /** The Space chat a game here starts from, or null. */
  conversationUuid: string | null;
  /** The sentence for a 403: the room's own rule about who hosts. */
  refusal403: string;
  /** The room's rule: may this viewer put a quiz live HERE? */
  mayHost: boolean;
  /** Authorship, or governance over a quiz written in this channel. */
  mayManage: boolean;
  hasLiveGame: boolean;
  /** `canPublishPublicly(session)` — whether "Everyone" is live. */
  canPublish: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLive: (gameUuid: string) => void;
  /** `null` clears a previous refusal. */
  onLiveRefused: (message: string | null) => void;
}) {
  const goLive = useGoLive(quiz.uuid);
  const noun = roomNoun(room);
  const count = quiz.question_count ?? quiz.questions?.length ?? 0;
  const shareable = quiz.visibility === 'link' || quiz.visibility === 'public';
  const share = useShareAction({ path: quizFrontHref(quiz.uuid), title: quiz.title });
  /** The visibility switch's refusal, said under the row it was pressed on.
   *  There are no toasts on these surfaces and the write is `silentError`. */
  const [refusal, setRefusal] = useState<string | null>(null);

  return (
    // ON A PHONE THE ACTIONS TAKE A LINE OF THEIR OWN. The raised Go live is
    // wider than the house button it replaced, and beside the menu it left the
    // words a stub ("10 questions ·..", the privacy chip cut in half; pictures
    // of 6f3dd1c9). Below `sm` the text fills the first line (its basis is the
    // row less the tile) and Go live with the menu wraps under it, at the
    // right; from `sm` it is one line again.
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl border-2 border-border bg-card p-3">
      {/* The quiz's face, as on the Quiz home's cards: the small tile, so a
          phone's row keeps its room for the title. */}
      <QuizTile uuid={quiz.uuid} title={quiz.title} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-0">
        {/* AT A NARROW WIDTH THE ROW'S HEIGHT GIVES, NOT THE TITLE. Go live and
            the overflow trigger are a fixed width whatever the row says, and a
            phone that hands the title what is left was cutting it to "Land
            registratio…" — a quiz the reader cannot identify is a row they
            cannot use. The width the sheet was actually rendering at is fixed
            above and returns most of that room; a second line covers the rest,
            rather than dropping the words off the one verb on the row. One line
            again from `sm`, where the column is wide enough that a second was
            only ever going to be a ragged half-line. */}
        <p className="line-clamp-2 text-sm font-semibold text-foreground sm:line-clamp-1">
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
              <LawexaMark className="size-3 shrink-0" />
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
          {/* The switch's state, legible without opening the menu. Owner-only
              — nobody else can see a private quiz in the first place — and for
              anything but `shared`, which is the room's own answer and needs
              no label here.

              IT IS THE ONE THING HERE BESIDES THE NAME THAT CAN GIVE, and it
              has to be: on the narrowest phone the avatar, the question count
              and this chip alone are wider than the column, so if every one of
              them held its width the line would spill sideways over the Go live
              button — which is worse than the wrap it replaced. The mark never
              shrinks, so it survives whatever happens to the words. */}
          {quiz.is_mine && quiz.visibility !== 'shared' && (
            <VisibilityChip visibility={quiz.visibility} />
          )}
        </div>
        {(refusal || share.copied) && (
          <p
            role={refusal ? 'alert' : 'status'}
            className="mt-2 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {refusal ?? 'Link copied'}
          </p>
        )}
      </div>

      {(mayHost || mayManage) && (
        <div className="flex w-full shrink-0 items-center justify-end gap-1 pb-1 sm:w-auto sm:pb-0">
          {/* The host policy governs starting a game… */}
          {mayHost && (
            <RaisedButton
              tone="quiet"
              className={cn(COMPACT_RAISED, 'px-3')}
              disabled={goLive.isPending || hasLiveGame}
              title={
                hasLiveGame
                  ? `A quiz is already running in this ${noun}`
                  : undefined
              }
              onClick={() => {
                // A fresh attempt clears the previous refusal (audit L8) — the
                // reader must never read last try's sentence over this try's
                // spinner.
                onLiveRefused(null);
                goLive.mutate({ room, conversationUuid }, {
                  onSuccess: (response) => onLive(response.data.uuid),
                  onError: (error) => {
                    const { status, message } = extractApiError(error);
                    onLiveRefused(
                      status === 409
                        ? `A quiz is already running in this ${noun}. Open it above, or wait for it to finish.`
                        : status === 403
                          ? refusal403
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
            </RaisedButton>
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
                    <VisibilityGroup
                      quiz={quiz}
                      canPublish={canPublish}
                      onRefused={setRefusal}
                    />
                    <DropdownMenuSeparator />
                  </>
                )}
                {/* Only where a link can open it: the quiz's front, where
                    anyone signed in takes it alone. */}
                {shareable && (
                  <DropdownMenuItem onClick={() => void share.share()}>
                    <Share2 aria-hidden className="size-4" />
                    Share
                  </DropdownMenuItem>
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

function QuizListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="flex items-start gap-3 rounded-2xl border-2 border-border/60 p-3"
          style={{ opacity: Math.max(0.3, 1 - index * 0.2) }}
        >
          <Skeleton className="mt-0.5 size-7 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="mt-2 h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
