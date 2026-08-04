'use client';

import { memo, useState } from 'react';
import {
  AlertCircle,
  CornerUpLeft,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatFullTimestamp } from '@/lib/utils/collab';
import type { Message } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { MESSAGE_MAX_LENGTH, mentionsViewer } from '../model';
import { useSendState } from '../send-outbox';
import { MessageContent } from './MessageContent';
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
 *    utility classes. Reply · Edit · Delete today; W3 appends react/pin/save
 *    to the same cluster (it is a plain flex row — extensible by design).
 *  - touch: long-press lifts the SAME action set into the feed's single
 *    bottom sheet (`onOpenActions`), with Cancel and destructive red.
 *
 * THE SEND LADDER (§5, exact): optimistic insert → `sending` (subtle dim,
 * no words) → sent (nothing at all) → `failed` (red icon + Retry inline,
 * never auto-dismissed, plus an explicit Discard — silent drops are banned).
 *
 * W3 SEAM — AI RENDERING: `is_ai` rows flow through the same
 * `MessageContent` plain-text path in W2; W3 swaps this branch for the ported
 * Lawexa markdown renderer. The discriminator is `is_ai` alone (§F.3).
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

  const mentioned = mentionsViewer(message.metadata.mentions, viewerUuid);
  const failed = sendState?.status === 'failed';
  const sending = sendState?.status === 'sending';
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
      {message.reply_to != null && (
        <ReplyQuote replyTo={message.reply_to} onJump={actions.onJumpToMessage} />
      )}

      <MessageContent
        content={message.content}
        metadata={message.metadata}
        viewerUuid={viewerUuid}
      />

      {message.edited_at && (
        <span
          className="ml-1 text-[11px] text-muted-foreground"
          title={formatFullTimestamp(message.edited_at)}
        >
          (edited)
        </span>
      )}

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
          buttons. A plain flex row: W3 appends react/pin/save without
          touching the mechanism. */}
      {canAct && (
        <div
          className={cn(
            'absolute -top-3.5 right-1 z-10 flex overflow-hidden rounded-lg border bg-background shadow-sm',
            'pointer-events-none opacity-0 transition-opacity duration-150 motion-reduce:transition-none',
            '[@media(hover:hover)_and_(pointer:fine)]:group-hover/msg:pointer-events-auto',
            '[@media(hover:hover)_and_(pointer:fine)]:group-hover/msg:opacity-100',
            'focus-within:pointer-events-auto focus-within:opacity-100',
          )}
        >
          <RowAction
            label="Reply"
            onClick={() => actions.onStartReply(message)}
          >
            <CornerUpLeft aria-hidden className="size-3.5" />
          </RowAction>
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

function RowAction({
  label,
  destructive = false,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
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
        'v2-interactive p-2 text-muted-foreground transition-colors duration-150 motion-reduce:transition-none',
        destructive
          ? 'hover:bg-destructive/10 hover:text-destructive'
          : 'hover:bg-muted hover:text-foreground',
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
