'use client';

import { memo, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  CornerUpLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Sparkles,
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
import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import type { Message } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useEngagementThrottled } from '../engagement-throttle';
import { MESSAGE_MAX_LENGTH, mentionsViewer } from '../model';
import { useSendState } from '../send-outbox';
import { LawexaMessageContent } from './LawexaMessageContent';
import { MESSAGE_MEASURE } from './measure';
import { MessageContent } from './MessageContent';
import { ReactionChips, ReactionTrayPopover } from './reactions';
import { useLongPress } from './use-long-press';

/**
 * MessageRow — one message line: reply quote, content, edited marker, the
 * send-state ladder, hover actions (pointer-fine) and the long-press seam
 * (touch). Phase-5 W2; the measure, the gutter time and the three-verb cluster
 * are the W2 redesign wave, 2026-08-05.
 *
 * MEMOISED BY MESSAGE REFERENCE. The feed re-renders on every cache write;
 * rows hold unless THEIR message object (or highlight/permission bits)
 * changed — the conversation screen's no-list-rerender discipline. The send
 * state is a per-row outbox subscription, so a delivery change re-renders
 * exactly one row.
 *
 * ── THE MEASURE ────────────────────────────────────────────────────────────
 * Text is capped at {@link MESSAGE_MEASURE} (~66 characters) while the ROW
 * keeps the full column. That is the direction's own rule, unenforced until
 * now, and it pays for itself twice: the line length lands inside the 50–75
 * band reading research agrees on, and the space it frees at the right edge is
 * exactly where the action cluster now lives without covering anything.
 *
 * ── THE GUTTER TIME ────────────────────────────────────────────────────────
 * Every message after a run's first carries its own clock time in the avatar
 * gutter, revealed on row hover. Before this, dating the fourth message of a
 * run meant counting from the header. It is `aria-hidden` on purpose: it is a
 * POINTER affordance duplicating a fact the run header already announces, and
 * a time read aloud before every line would bury the messages themselves.
 * The full moment stays one hover away in `title`.
 *
 * ── ACTIONS, TWO INPUT WORLDS (DIRECTION 5 — never permanent toolbars) ─────
 *  - pointer-fine: THREE verbs — react, reply, overflow — vertically centred
 *    at the row's right edge behind a gradient, revealed on hover/focus. The
 *    shipped cluster was seven equally-weighted glyphs pinned at `-top-3.5`,
 *    which is to say: on top of the previous author's last line. Seven glyphs
 *    is a toolbar, and a toolbar that occludes someone else's words is the
 *    worst version of one. What is left is what a row is actually for —
 *    respond, reply, everything else;
 *  - touch: long-press lifts the FULL action set into the feed's single bottom
 *    sheet (`onOpenActions`), unchanged, with Copy text at its head.
 *
 * THE SEND LADDER (§5, exact): optimistic insert → `sending` (subtle dim,
 * no words) → sent (nothing at all) → `failed` (red icon + Retry inline,
 * never auto-dismissed, plus an explicit Discard — silent drops are banned).
 */

/** The empty handler set a read-only row spreads instead of the hold gesture.
 *  Module-scoped so it is one object for the whole feed. */
const NO_LONG_PRESS = {} as const;

/** One cluster control's shape — shared by the plain buttons and the overflow
 *  trigger, which cannot be a component because Radix needs the element. */
const ROW_ACTION =
  'v2-interactive flex size-8 items-center justify-center transition-colors duration-150 motion-reduce:transition-none';

export interface MessageRowActions {
  onStartReply: (message: Message) => void;
  onStartDelete: (message: Message) => void;
  /** Put a row into edit mode — feed-owned so the touch sheet can open it too. */
  onStartEdit: (message: Message) => void;
  onCloseEdit: () => void;
  /** Stable edit dispatcher (wraps the mutation's stable `mutate`). */
  onSaveEdit: (
    messageUuid: string,
    content: string,
    callbacks: { onSuccess: () => void; onError: () => void },
  ) => void;
  onRetrySend: (message: Message) => void;
  onDiscardFailed: (localUuid: string) => void;
  /** Touch long-press → the feed's single action sheet. */
  onOpenActions: (message: Message) => void;
  /** Tap a reply quote → jump to (and wash) the quoted message. */
  onJumpToMessage: (messageUuid: string) => void;
  /** Toggle one emoji on this message (the exact string, §F.9). */
  onToggleReaction: (message: Message, emoji: string) => void;
  /** Pin / unpin for everyone — any active member may do both (§C). */
  onTogglePin: (message: Message) => void;
  /** Save / unsave privately — never broadcast (§F.2). */
  onToggleSave: (message: Message) => void;
  /** Open the Lawexa session behind an AI reply (`metadata.session_uuid`). */
  onViewAiSession: (sessionUuid: string) => void;
}

export const MessageRow = memo(function MessageRow({
  message,
  canEngage,
  canEdit,
  canDelete,
  viewerUuid,
  showGutterTime,
  editing,
  actions,
}: {
  message: Message;
  /**
   * May the viewer act on this message at all? False in the feed's read-only
   * mode (a space member previewing a `space_public` channel they never
   * joined), where react, reply, save, pin, edit and delete are all refused
   * server-side.
   *
   * IT TAKES BOTH INPUT WORLDS AWAY, which is the point: hiding the hover
   * cluster alone would leave the long-press seam opening a sheet full of
   * verbs that 403. The reply QUOTE stays tappable — jumping to a quoted
   * message is a read.
   */
  canEngage: boolean;
  canEdit: boolean;
  canDelete: boolean;
  viewerUuid: string | null;
  /** False for a run's first message, which the run header already dates. */
  showGutterTime: boolean;
  /** Feed-owned edit mode (one row at a time; the touch sheet opens it too). */
  editing: boolean;
  actions: MessageRowActions;
}) {
  const sendState = useSendState(message.uuid);
  const saveThrottled = useEngagementThrottled('bookmark');

  const mentioned = mentionsViewer(message.metadata.mentions, viewerUuid);
  const failed = sendState?.status === 'failed';
  const sending = sendState?.status === 'sending';
  const pinned = message.is_pinned === true;
  const saved = message.is_bookmarked === true;
  // Only AI replies have a session behind them, and only since 2026-08-03
  // (older history carries `null` — digest §F.6). No id, no affordance.
  const sessionUuid = message.is_ai ? (message.metadata.session_uuid ?? null) : null;
  // Reply is universal, so every REAL (server-acknowledged) row acts — for a
  // viewer who may act at all; a row still in the outbox has nothing
  // actionable but Retry/Discard below.
  const canAct = canEngage && sendState === null;
  const longPress = useLongPress(() => {
    if (!sendState && !editing) actions.onOpenActions(message);
  });
  /** THE GESTURE IS ONLY ATTACHED WHERE IT LEADS SOMEWHERE. In read-only mode
   *  there is no sheet to open, and an attached hold would still tint the row,
   *  buzz the phone and clear the reader's selection on the way to doing
   *  nothing. */
  const holdHandlers = canEngage ? longPress : NO_LONG_PRESS;

  if (editing) {
    // Keyed by uuid so the draft state initialises fresh per edit session.
    return <MessageEditBox key={message.uuid} message={message} actions={actions} />;
  }

  return (
    <div
      data-message-uuid={message.uuid}
      {...holdHandlers}
      className={cn(
        'group/msg relative -mx-2 rounded-md px-2 py-0.5',
        'transition-colors duration-200 motion-reduce:transition-none',
        '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40',
        // THE ROW OWNS THE TOUCH-AND-HOLD GESTURE (owner, Aug 4). It suppresses
        // iOS's own callout + selection loupe, which used to come up UNDER the
        // actions sheet, and lets a vertical scroll win at the browser level.
        // The rule is static because iOS decides selectability when the finger
        // lands, and it is split by pointer type — a mouse keeps ordinary
        // selection, a finger gets the sheet's "Copy text" instead. See
        // `shell.css` for which half applies where.
        //
        // ONLY WHERE THE SHEET EXISTS TO REPLACE IT. The trade is "finger
        // selection for a menu with Copy text"; in read-only mode there is no
        // menu, so taking selection away would leave a previewer on a phone
        // unable to copy anything at all. They keep the browser's own gesture.
        canEngage && 'v2-touch-hold',
        // Armed-hold feedback: `use-long-press` stamps this attribute straight
        // onto the node (no React state — the row is memoised), and the
        // `transition-colors` above fades it both ways.
        'data-holding:bg-muted/60',
        // Self-mention wash: quiet gold tint + a gold left edge (DIRECTION 2;
        // the audit's missing v1 affordance).
        mentioned && 'bg-primary/5',
        // Deep-link / reply-jump wash: the feed stamps `data-flash` on the DOM
        // node (no React state — rows stay memo-stable) and `transition-colors`
        // above plays the fade both ways.
        'data-flash:bg-primary/15',
        sending && 'opacity-70',
      )}
    >
      {mentioned && (
        <span
          aria-hidden
          className="absolute inset-y-0.5 left-0 w-0.5 rounded-full bg-primary/70"
        />
      )}

      {/* The gutter clock — see the docblock for why it is `aria-hidden`.

          IT IS OPAQUE, AND THAT IS LOAD-BEARING. It sits entirely outside the
          row (`right-full`), in the author column, which is exactly where
          `MessageGroupRow`'s continuity rail runs — so a transparent label
          would be struck through by a 1px line. `bg-background` is the colour
          of that column at every row state (the row's own hover and mention
          tints stop at the row's edge and never reach here), so the chip is an
          exact match and simply interrupts the rail for the line being dated.
          That break IS the affordance: the rail parts where the time appears. */}
      {showGutterTime && (
        <time
          aria-hidden
          dateTime={message.created_at}
          title={formatFullTimestamp(message.created_at)}
          className={cn(
            'pointer-events-none absolute top-1 right-full mr-1 whitespace-nowrap',
            'rounded bg-background px-1',
            'text-[10px] leading-4 tabular-nums text-muted-foreground/70 opacity-0',
            'transition-opacity duration-150 motion-reduce:transition-none',
            '[@media(hover:hover)_and_(pointer:fine)]:group-hover/msg:opacity-100',
          )}
        >
          {formatMessageTime(message.created_at)}
        </time>
      )}

      {/* EVERYTHING THE ROW SAYS LIVES INSIDE THE MEASURE — the quote, the
          text, the chips and the failure line — so a reply preview can never be
          wider than the message it belongs to and the whole row reads as one
          column. `text-[0.9375rem]` is here because `ch` resolves against the
          element's own font size: the children all set their own size, this
          only makes 66ch mean 66 characters of BODY text. */}
      <div className={cn(MESSAGE_MEASURE, 'text-[0.9375rem]')}>
        {/* Pin marker — quiet, above the content, and only ever on the few rows
            that carry it. The pinned SURFACE lives off the channel header
            (DIRECTION 5); this line exists so a reader scrolling past knows why
            a message will also be found there. */}
        {pinned && (
          <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Pin aria-hidden className="size-3 shrink-0" />
            Pinned
          </div>
        )}

        {message.reply_to != null && (
          <ReplyQuote replyTo={message.reply_to} onJump={actions.onJumpToMessage} />
        )}

        {message.is_ai ? (
          <LawexaMessageContent
            content={message.content}
            metadata={message.metadata}
            viewerUuid={viewerUuid}
          />
        ) : (
          <MessageContent
            content={message.content}
            metadata={message.metadata}
            viewerUuid={viewerUuid}
          />
        )}

        {message.edited_at && (
          <span
            className="ml-1 text-[11px] text-muted-foreground"
            title={formatFullTimestamp(message.edited_at)}
          >
            (edited)
          </span>
        )}

        <ReactionChips
          reactions={message.reactions}
          readOnly={!canEngage}
          onToggle={(emoji) => actions.onToggleReaction(message, emoji)}
        />

        {/* THE SEND LADDER'S LAST RUNG, and the one place a write can outlive
            the right to make it. A row reaches `failed` while the viewer was a
            member; membership can end between the failure and the next glance —
            removed by an admin, the detail refetch flips `is_member`, and the
            outbox row is still merged into the transcript because a failed send
            is never silently dropped.

            RETRY IS THE VERB THAT GOES. It would re-POST straight into a 403,
            turning "not sent" into "not sent, twice, for a reason we didn't
            explain". DISCARD STAYS, and it must: the row is the reader's own
            unsent words, it is the only thing on screen that can remove them,
            and a stranded row with no way to clear it would sit in the
            transcript forever. So the honest offer to someone who can no longer
            post is exactly one: let it go. */}
        {failed && (
          <div className="mt-1 flex items-center gap-2 text-xs font-medium text-destructive">
            <AlertCircle aria-hidden className="size-3.5 shrink-0" />
            <span>Not sent</span>
            {canEngage && (
              <button
                type="button"
                onClick={() => actions.onRetrySend(message)}
                className={cn('rounded underline underline-offset-2', FOCUS_RING)}
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => actions.onDiscardFailed(message.uuid)}
              className={cn(
                'rounded text-muted-foreground underline underline-offset-2',
                FOCUS_RING,
              )}
            >
              Discard
            </button>
          </div>
        )}
      </div>

      {/* Hover action cluster — OPACITY-gated, never display-gated (audit H2):
          children of `display:none` can never receive focus, so a hidden
          cluster would strand keyboard users. Always rendered; shown on
          pointer-fine hover, and by `focus-within` the moment a Tab lands on a
          button.

          THE THIRD REVEAL CONDITION exists for the two portalled surfaces:
          Radix moves the reaction tray and the overflow menu OUT of this
          element, so focus landing in either does NOT satisfy `focus-within` —
          the cluster would vanish the instant one opened, leaving a dead
          trigger under the pointer. `has-data-[state=open]` reads the
          TRIGGERS' own state, which never leaves the cluster.

          The outer box spans the row and is inert to the pointer, so the
          centred cluster inside it can never intercept a text selection drag
          across the rest of the row. */}
      {canAct && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center">
          <div
            className={cn(
              'flex items-center opacity-0',
              'transition-opacity duration-150 motion-reduce:transition-none',
              '[@media(hover:hover)_and_(pointer:fine)]:group-hover/msg:pointer-events-auto',
              '[@media(hover:hover)_and_(pointer:fine)]:group-hover/msg:opacity-100',
              'focus-within:pointer-events-auto focus-within:opacity-100',
              'has-data-[state=open]:pointer-events-auto has-data-[state=open]:opacity-100',
            )}
          >
            {/* The mask: text runs out under the cluster instead of stopping
                dead against it.

                IT FADES TO THE CLUSTER'S SURFACE, NOT TO THE ROW'S. The cluster
                is an opaque `bg-background` island, so the mask ends on exactly
                the colour it meets and the two read as one object with no seam.
                It does NOT reproduce the row's own tint — the `muted/40` of a
                hover or the `primary/5` of a mention — and it cannot: a single
                gradient takes one end colour, and the row can be either. What
                that costs is a soft luminance step where the mask turns opaque
                over a tinted row, spread across 40px and at 40% of the muted
                token; what it buys is that the mask and the island are never
                two different greys sitting next to each other, which is the
                seam a reader would actually notice. */}
            <span
              aria-hidden
              className="pointer-events-none w-10 self-stretch bg-gradient-to-r from-transparent to-background"
            />
            <div className="flex items-center overflow-hidden rounded-lg border bg-background shadow-sm">
              <ReactionTrayPopover
                reactions={message.reactions}
                onPick={(emoji) => actions.onToggleReaction(message, emoji)}
                className="size-8 p-0"
              />
              <RowAction label="Reply" onClick={() => actions.onStartReply(message)}>
                <CornerUpLeft aria-hidden className="size-4" />
              </RowAction>

              {/* Everything else. Save and pin were two of seven identical
                  glyphs; here they are named verbs, which is also the only way
                  a reader learns that save is private and pin is not. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More actions"
                    title="More actions"
                    className={cn(
                      ROW_ACTION,
                      'text-muted-foreground hover:bg-muted hover:text-foreground',
                      FOCUS_RING,
                    )}
                  >
                    <MoreHorizontal aria-hidden className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    disabled={saveThrottled}
                    onClick={() => actions.onToggleSave(message)}
                  >
                    <Bookmark
                      aria-hidden
                      className={cn('size-4', saved && 'fill-current')}
                    />
                    {saved ? 'Remove from saved' : 'Save for me'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => actions.onTogglePin(message)}>
                    {pinned ? (
                      <PinOff aria-hidden className="size-4" />
                    ) : (
                      <Pin aria-hidden className="size-4" />
                    )}
                    {pinned ? 'Unpin from channel' : 'Pin to channel'}
                  </DropdownMenuItem>
                  {sessionUuid && (
                    <DropdownMenuItem
                      onClick={() => actions.onViewAiSession(sessionUuid)}
                    >
                      <Sparkles aria-hidden className="size-4" />
                      View this Lawexa conversation
                    </DropdownMenuItem>
                  )}
                  {(canEdit || canDelete) && <DropdownMenuSeparator />}
                  {canEdit && (
                    <DropdownMenuItem onClick={() => actions.onStartEdit(message)}>
                      <Pencil aria-hidden className="size-4" />
                      Edit message
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => actions.onStartDelete(message)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                      Delete message
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * One plain cluster button. No `aria-pressed` anywhere in the cluster any
 * more: the two TOGGLES (save, pin) moved into the overflow menu, where their
 * state is carried by the verb itself ("Unpin from channel"), and react and
 * reply were never switches.
 */
function RowAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        ROW_ACTION,
        'text-muted-foreground hover:bg-muted hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

/** The inline edit box — its own component (keyed by uuid at the call site)
 *  so draft/saving/error state initialises fresh per edit session and lives
 *  nowhere once the edit closes. */
function MessageEditBox({
  message,
  actions,
}: {
  message: Message;
  actions: MessageRowActions;
}) {
  const [draft, setDraft] = useState(message.content);
  const [isSaving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const saveEdit = () => {
    const content = draft.trim();
    if (!content || content === message.content) {
      actions.onCloseEdit();
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    actions.onSaveEdit(message.uuid, content, {
      onSuccess: () => {
        setSaving(false);
        actions.onCloseEdit();
      },
      onError: () => {
        setSaving(false);
        setSaveFailed(true);
      },
    });
  };

  return (
    <div className={cn('rounded-lg border bg-background p-2', MESSAGE_MEASURE)}>
      <textarea
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Enter during IME composition confirms the composition, never the
          // save (audit M5 — CJK input).
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            saveEdit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            actions.onCloseEdit();
          }
        }}
        rows={2}
        maxLength={MESSAGE_MAX_LENGTH}
        aria-label="Edit message"
        className="w-full resize-none bg-transparent text-[0.9375rem] leading-relaxed outline-none"
      />
      {saveFailed && (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle aria-hidden className="size-3.5" />
          Couldn&rsquo;t save this edit. Try again.
        </p>
      )}
      <div className="mt-1 flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={actions.onCloseEdit}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={saveEdit} disabled={isSaving || !draft.trim()}>
          {isSaving && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

/**
 * The inline reply quote (DIRECTION 4 — replies are inline quotes, no side
 * threads; Telegram's tap-to-jump is the target interaction). The preview is
 * a live server read: a deleted target arrives as `is_deleted` with a null
 * preview and renders as a quiet tombstone, not a broken quote.
 */
function ReplyQuote({
  replyTo,
  onJump,
}: {
  replyTo: NonNullable<Message['reply_to']>;
  onJump: (messageUuid: string) => void;
}) {
  const authorName = replyTo.is_ai
    ? 'Lawexa'
    : (replyTo.author?.name ?? 'Deleted member');

  if (replyTo.is_deleted) {
    return (
      <div className="mb-1 flex items-center gap-1.5 border-l-2 border-border pl-2 text-xs text-muted-foreground italic">
        <CornerUpLeft aria-hidden className="size-3 shrink-0" />
        Original message was deleted
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onJump(replyTo.uuid)}
      className={cn(
        'v2-interactive mb-1 flex w-fit max-w-full items-baseline gap-1.5 rounded-sm border-l-2 border-primary/50 pr-1 pl-2 text-left text-xs',
        'text-muted-foreground transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
        FOCUS_RING,
      )}
    >
      <CornerUpLeft aria-hidden className="size-3 shrink-0 self-center" />
      <span className="shrink-0 font-medium text-foreground/80">{authorName}</span>
      <span className="truncate">{replyTo.content_preview ?? ''}</span>
    </button>
  );
}
