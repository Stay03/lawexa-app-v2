'use client';

import { memo, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  CornerUpLeft,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatFullTimestamp } from '@/lib/utils/collab';
import type { Message } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useEngagementThrottled } from '../engagement-throttle';
import { MESSAGE_MAX_LENGTH, mentionsViewer } from '../model';
import { useSendState } from '../send-outbox';
import { LawexaMessageContent } from './LawexaMessageContent';
import { MessageContent } from './MessageContent';
import { ReactionChips, ReactionTrayPopover } from './reactions';
import { useLongPress } from './use-long-press';

/**
 * MessageRow — one message line: reply quote, content, edited marker, the
 * send-state ladder, hover actions (pointer-fine) and the long-press seam
 * (touch). Phase-5 W2; sources: study A4, foundation-standards §5,
 * design-research DIRECTIONS 2/4/5/9 — 2026-08-04.
 *
 * MEMOISED BY MESSAGE REFERENCE. The feed re-renders on every cache write;
 * rows hold unless THEIR message object (or highlight/permission bits)
 * changed — the conversation screen's no-list-rerender discipline. The send
 * state is a per-row outbox subscription, so a delivery change re-renders
 * exactly one row.
 *
 * ACTIONS, TWO INPUT WORLDS (DIRECTION 5 — never permanent toolbars):
 *  - pointer-fine: a hairline action cluster revealed on row hover/focus,
 *    hidden at `pointer: coarse` via the `@media (hover: hover)`-guarded
 *    utility classes. React · Reply · Save · Pin · Edit · Delete.
 *  - touch: long-press lifts the SAME action set into the feed's single
 *    bottom sheet (`onOpenActions`), with Cancel and destructive red.
 *
 * THE SEND LADDER (§5, exact): optimistic insert → `sending` (subtle dim,
 * no words) → sent (nothing at all) → `failed` (red icon + Retry inline,
 * never auto-dismissed, plus an explicit Discard — silent drops are banned).
 *
 * W3 — ENGAGEMENT + AI RENDERING:
 *  - `is_ai` rows now render through {@link LawexaMessageContent} (markdown +
 *    mention chips); humans keep the plain-text {@link MessageContent}. The
 *    discriminator is `is_ai` ALONE — a hard-deleted human is also
 *    `author: null` and must never be rendered as Lawexa (digest §F.3).
 *  - reaction chips sit under the content, pins show a quiet marker above it,
 *    and save is a cluster toggle with no visible trace on the row (it is
 *    private — a badge would leak it to a shoulder).
 */

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
  canEdit,
  canDelete,
  viewerUuid,
  editing,
  actions,
}: {
  message: Message;
  canEdit: boolean;
  canDelete: boolean;
  viewerUuid: string | null;
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
  // Reply is universal, so every REAL (server-acknowledged) row acts; a row
  // still in the outbox has nothing actionable but Retry/Discard below.
  const canAct = sendState === null;
  const longPress = useLongPress(() => {
    if (!sendState && !editing) actions.onOpenActions(message);
  });

  if (editing) {
    // Keyed by uuid so the draft state initialises fresh per edit session.
    return <MessageEditBox key={message.uuid} message={message} actions={actions} />;
  }

  return (
    <div
      data-message-uuid={message.uuid}
      {...longPress}
      className={cn(
        'group/msg relative -mx-2 rounded-md px-2 py-0.5',
        'transition-colors duration-200 motion-reduce:transition-none',
        '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40',
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
        onToggle={(emoji) => actions.onToggleReaction(message, emoji)}
      />

      {failed && (
        <div className="mt-1 flex items-center gap-2 text-xs font-medium text-destructive">
          <AlertCircle aria-hidden className="size-3.5 shrink-0" />
          <span>Not sent</span>
          <button
            type="button"
            onClick={() => actions.onRetrySend(message)}
            className={cn('rounded underline underline-offset-2', FOCUS_RING)}
          >
            Retry
          </button>
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

      {/* Hover action cluster — OPACITY-gated, never display-gated (audit
          H2): children of `display:none` can never receive focus, so a
          hidden cluster would strand keyboard users. Always rendered; shown
          on pointer-fine hover, and by `focus-within` the moment a Tab lands
          on a button (the FilesTab / ListItemRow reveal pattern).
          `pointer-events-none` while invisible so touch can't hit ghost
          buttons.

          THE THIRD REVEAL CONDITION exists for the reaction tray: Radix
          PORTALS the popover out of this element, so focus moving into the
          tray does NOT satisfy `focus-within` — the cluster would vanish the
          instant the tray opened, and the pointer would leave a dead trigger
          behind. `has-data-[state=open]` reads the trigger's own state, which
          stays inside the cluster, and holds it visible until the tray closes.

          ORDER IS BY FREQUENCY, not by power: react and reply are what most
          rows get, save and pin are occasional, and the two author-only verbs
          sit last so a mis-aimed click lands on something reversible. */}
      {canAct && (
        <div
          className={cn(
            'absolute -top-3.5 right-1 z-10 flex overflow-hidden rounded-lg border bg-background shadow-sm',
            'pointer-events-none opacity-0 transition-opacity duration-150 motion-reduce:transition-none',
            '[@media(hover:hover)_and_(pointer:fine)]:group-hover/msg:pointer-events-auto',
            '[@media(hover:hover)_and_(pointer:fine)]:group-hover/msg:opacity-100',
            'focus-within:pointer-events-auto focus-within:opacity-100',
            'has-data-[state=open]:pointer-events-auto has-data-[state=open]:opacity-100',
          )}
        >
          <ReactionTrayPopover
            reactions={message.reactions}
            onPick={(emoji) => actions.onToggleReaction(message, emoji)}
          />
          <RowAction
            label="Reply"
            onClick={() => actions.onStartReply(message)}
          >
            <CornerUpLeft aria-hidden className="size-3.5" />
          </RowAction>
          <RowAction
            label={saved ? 'Remove from saved' : 'Save message'}
            pressed={saved}
            disabled={saveThrottled}
            onClick={() => actions.onToggleSave(message)}
          >
            <Bookmark
              aria-hidden
              className={cn('size-3.5', saved && 'fill-current')}
            />
          </RowAction>
          <RowAction
            label={pinned ? 'Unpin message' : 'Pin message'}
            pressed={pinned}
            onClick={() => actions.onTogglePin(message)}
          >
            {pinned ? (
              <PinOff aria-hidden className="size-3.5" />
            ) : (
              <Pin aria-hidden className="size-3.5" />
            )}
          </RowAction>
          {sessionUuid && (
            <RowAction
              label="View this Lawexa conversation"
              onClick={() => actions.onViewAiSession(sessionUuid)}
            >
              <Sparkles aria-hidden className="size-3.5" />
            </RowAction>
          )}
          {canEdit && (
            <RowAction
              label="Edit message"
              onClick={() => actions.onStartEdit(message)}
            >
              <Pencil aria-hidden className="size-3.5" />
            </RowAction>
          )}
          {canDelete && (
            <RowAction
              label="Delete message"
              destructive
              onClick={() => actions.onStartDelete(message)}
            >
              <Trash2 aria-hidden className="size-3.5" />
            </RowAction>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * One cluster button.
 *
 * `pressed` is `undefined` for the plain verbs (Reply / Edit / Delete) and a
 * boolean for the two TOGGLES (save, pin) — so only the toggles carry
 * `aria-pressed`, and a screen reader is never told that "Reply" is a switch
 * that happens to be off. `disabled` is only ever the quiet throttle state.
 */
function RowAction({
  label,
  destructive = false,
  pressed,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'v2-interactive p-2 transition-colors duration-150 motion-reduce:transition-none',
        pressed ? 'text-primary' : 'text-muted-foreground',
        destructive
          ? 'hover:bg-destructive/10 hover:text-destructive'
          : 'hover:bg-muted hover:text-foreground',
        disabled && 'pointer-events-none opacity-50',
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
    <div className="rounded-lg border bg-background p-2">
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
        'v2-interactive mb-1 flex w-fit max-w-full items-baseline gap-1.5 rounded-sm border-l-2 border-primary/50 pl-2 pr-1 text-left text-xs',
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
