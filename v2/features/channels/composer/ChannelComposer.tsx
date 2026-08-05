'use client';

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AtSign,
  CornerUpLeft,
  Paperclip,
  SendHorizontal,
  Smile,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { extractApiError } from '@/lib/utils/api-error';
import type { Channel, Message, MessageReplyTo } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useUploadChannelFile } from '../lists-files-mutations';
import { useSendChannelMessage } from '../message-mutations';
import {
  buildMentionOptions,
  FILE_ACCEPT_ATTR,
  MESSAGE_MAX_LENGTH,
  REACTION_TRAY,
  untaggableSentence,
  validateChannelFile,
  type MentionCandidate,
} from '../model';
import { channelsQueries } from '../queries';
import { MemberAvatar, LawexaAvatar } from '../ui/avatars';
import type { TypingUser } from '../room';
import { useHeldValue } from '../use-held-value';
import {
  ChatComposerShell,
  ComposerAction,
  ComposerNotice,
  ComposerTrayRow,
  COMPOSER_ACTION,
} from './ChatComposerShell';

/**
 * ChannelComposer — the channel's own composer on {@link ChatComposerShell}:
 * the transcript's column, one rounded surface, and an inner row of
 * attach · mention · emoji · textarea · send. Phase-5 W2, rebuilt in the W2
 * redesign wave (2026-08-05) after the owner's verdict that the shipped one
 * was the AI-chat pill rescaled.
 *
 * SEND is optimistic and NON-BLOCKING: the input clears immediately, the row
 * appears as `sending`, and a failure surfaces ON THE ROW (Retry/Discard —
 * never a rollback, never a toast). The composer never disables while a send
 * is in flight — Discord-fluid, and §5's ladder makes it safe.
 *
 * REPLY (DIRECTION 4): one staged quote bar above the surface, cancel with one
 * tap or Escape; sends `reply_to_uuid` and pre-builds the optimistic row's
 * quote so it renders before the server echoes. The bar collapses with the
 * shared symmetric grid-rows tween and holds its last content through the exit
 * so it never flashes empty.
 *
 * ATTACH IS NEW, AND IT IS THE SAME UPLOAD THE FILES SECTION MAKES — ALL THE
 * WAY DOWN. There was no attachment affordance anywhere in the conversation
 * despite a whole Files section: the only way to put a document in a channel
 * was to leave the conversation, find the section and drop it there. This runs
 * the existing `useUploadChannelFile` (same allow-list, same 15MB cap, same
 * cache writer), so an attachment IS a file in the library — and the notice
 * that confirms it says exactly that, with a way to go and look.
 *
 * IT TAKES THE PROGRESS AND THE CANCEL TOO. The hook's object form carries
 * `onProgress` and `signal`, so each in-flight chip shows a determinate
 * percentage and can be called off. The bare-`File` shorthand exists for a
 * caller with nowhere to put either, and this is not one: the same operation
 * must not feel like two different things depending on which end of the screen
 * it was started from. Percent is BYTES ON THE WIRE, never completion — at 100%
 * the server is still storing and sniffing, so the chip stays until the promise
 * settles rather than vanishing at the top of the bar. A cancellation rejects
 * like any other failure, so the composer remembers that it asked and stays
 * silent instead of reporting a problem the reader caused on purpose.
 *
 * EMOJI IS THE PRODUCT'S ONE VOCABULARY. It inserts from `REACTION_TRAY`, the
 * curated set the reaction surfaces already use, rather than shipping an emoji
 * keyboard (a dependency, a search box and a grid of two thousand pictures
 * hanging off a chat row). It is a separate control from `ReactionTrayRow`
 * because the semantics differ: those keys are toggles carrying `aria-pressed`
 * against a message's buckets, these insert text at a caret.
 *
 * MENTIONS: `@` triggers the roster autocomplete plus the synthetic Lawexa
 * candidate; ArrowUp/Down navigate, Enter/Tab apply, Escape dismisses. The
 * AtSign control drops an `@` at the caret and opens the picker (v1's
 * affordance).
 *
 * WHAT IT INSERTS IS THE MEMBER'S UNIQUE `@username` (§F.19). It used to insert
 * a slug of the display name, which as of 2026-08-05 tags nobody. Each row
 * carries name + handle, so the two people called "Ada Obi" — the case this
 * whole change exists for — are told apart BEFORE either is picked, and the
 * query matches either field so nobody has to know a handle to use one.
 *
 * A MEMBER WITH NO HANDLE IS NEVER A ROW. No string tags them — guests never
 * get a handle, and neither does any account still waiting on the backfill —
 * and a row that cannot keep its promise is worse than no row at all. They are
 * named instead in one quiet line under the list, because a reader who can see
 * someone in the member list and not here is owed the reason. Measured
 * 2026-08-05, that line is currently the whole picker.
 *
 * THE COUNTER APPEARS AT 200 REMAINING, not 500. At 500 it was on screen for
 * a message most people never write, which made a number ride the composer
 * during ordinary typing for no reason; 200 is close enough to the wall to be
 * a warning rather than furniture.
 *
 * KEYBOARD: Enter sends / Shift+Enter breaks on precise-pointer setups; on
 * touch (`hover: none`, read at event time) Enter breaks and the send button
 * posts — the v1 contract, kept. The surface rides the keyboard through the
 * shell's dvh + `--keyboard-inset` region (never `position: fixed`).
 */

const MAX_SUGGESTIONS = 6;

/** How much room is left before the counter is worth showing. */
const COUNTER_AT = 200;

export interface ChannelComposerHandle {
  focus: () => void;
}

export interface ChannelComposerProps {
  channel: Channel;
  viewerId: number | null;
  replyTo: Message | null;
  onCancelReply: () => void;
  /** Throttled typing whisper (the room hook's emitter). */
  onTyping: () => void;
  /** Who is typing right now — rendered as the shell's top-edge legend. */
  typingUsers: readonly TypingUser[];
  /** A send was ACCEPTED by the server — the screen advances the read
   *  pointer with the new uuid (§5's send trigger). */
  onSentSuccess: (serverUuid: string) => void;
  /** Show the Files section — offered after an attachment lands. */
  onOpenFiles: () => void;
  ref?: React.Ref<ChannelComposerHandle>;
}

/** Build the optimistic row's quote context from the reply target. */
function toReplyPreview(message: Message): MessageReplyTo {
  return {
    uuid: message.uuid,
    is_ai: message.is_ai,
    author: message.author,
    content_preview: message.content.slice(0, 200),
    is_deleted: false,
    type: message.metadata.type,
  };
}

interface ComposerNoticeState {
  tone: 'failure' | 'done';
  text: string;
  /** True when the notice is about a file that reached the library. */
  landed: boolean;
}

/** One upload the composer started and has not yet heard back about. */
interface PendingUpload {
  id: number;
  name: string;
  /** Whole percent of BYTES SENT — not completion. See the docblock. */
  percent: number;
  controller: AbortController;
}

export function ChannelComposer({
  channel,
  viewerId,
  replyTo,
  onCancelReply,
  onTyping,
  typingUsers,
  onSentSuccess,
  onOpenFiles,
  ref,
}: ChannelComposerProps) {
  const [value, setValue] = useState('');
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [notice, setNotice] = useState<ComposerNoticeState | null>(null);
  const [uploading, setUploading] = useState<readonly PendingUpload[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadIdRef = useRef(0);
  /** Uploads the reader called off. An abort rejects like any other failure,
   *  so this is how the composer tells "it broke" from "I stopped it". */
  const cancelledUploadsRef = useRef(new Set<number>());

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const send = useSendChannelMessage(channel.uuid);
  const upload = useUploadChannelFile(channel.uuid);
  const uploadMutate = upload.mutate;
  const membersQuery = useQuery({
    ...channelsQueries.members(channel.uuid, { viewerId }),
    enabled: channel.is_member === true,
  });

  // Auto-grow the textarea to a cap, then scroll internally — a DOM height
  // write (no state); a raw textarea is needed here for caret-aware mention
  // parsing.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const options = useMemo(
    () => buildMentionOptions(membersQuery.data?.data ?? []),
    [membersQuery.data],
  );

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query;
    return options.candidates
      .filter(
        (candidate) =>
          candidate.handle.includes(query) ||
          candidate.name.toLowerCase().includes(query),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [mention, options]);

  /** Members the same query names who have no handle — the picker's one
   *  explanatory line, never rows. Filtered by the SAME query so the sentence
   *  answers the search that is on screen, not the whole roster. */
  const untaggable = useMemo(() => {
    if (!mention) return '';
    const query = mention.query;
    return untaggableSentence(
      options.untaggable.filter((name) => name.toLowerCase().includes(query)),
    );
  }, [mention, options]);

  /** Is the picker actually ON SCREEN? A pending `@token` that matches nobody
   *  and explains nobody shows nothing, and Escape must not be swallowed by an
   *  invisible surface — the reply bar behind it is what the reader meant. */
  const pickerOpen = mention !== null && (suggestions.length > 0 || untaggable !== '');

  // Every tray row — and the typing legend — holds its last content through
  // its own fade, so nothing ever animates out while empty.
  const replyShown = useHeldValue(replyTo);
  const aiNoticeShown = useHeldValue(aiNotice);
  const noticeShown = useHeldValue(notice);
  const typing = typingUsers.length > 0;
  const typingShown = useHeldValue(typing ? typingLabel(typingUsers) : null);

  const detectMention = (nextValue: string, caret: number) => {
    const upToCaret = nextValue.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([a-z0-9._]*)$/i);
    if (match) {
      setMention({ query: match[1].toLowerCase(), start: caret - match[1].length - 1 });
      setActiveIndex(0);
    } else {
      setMention(null);
    }
  };

  /** Put text where the caret is and leave the caret after it. Shared by the
   *  mention affordance and the emoji picker so the two can never drift on
   *  focus restoration or caret maths. */
  const insertAtCaret = (
    text: string,
    options?: { spaceGuard?: boolean; thenDetect?: boolean },
  ) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const inserted =
      options?.spaceGuard && before.length > 0 && !/\s$/.test(before)
        ? ` ${text}`
        : text;
    const nextValue = before + inserted + value.slice(caret);
    const nextCaret = caret + inserted.length;
    setValue(nextValue);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (node) {
        node.focus();
        node.setSelectionRange(nextCaret, nextCaret);
      }
      if (options?.thenDetect) detectMention(nextValue, nextCaret);
    });
  };

  const applyMention = (candidate: MentionCandidate) => {
    if (!mention) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.start + 1 + mention.query.length);
    const inserted = `@${candidate.handle} `;
    const nextValue = before + inserted + after;
    const caret = (before + inserted).length;
    setValue(nextValue);
    setMention(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  /* ── Attachments ──────────────────────────────────────────────────────────
        Client pre-validation only saves a round trip — the server sniffs the
        content, so a renamed `.exe` still 422s and lands in the same notice.
        A rejection never enters the in-flight list, so the "uploading" row is
        only ever things that are actually uploading. ─────────────────────── */
  const attachFiles = (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      const invalid = validateChannelFile(file);
      if (invalid) {
        setNotice({ tone: 'failure', text: invalid, landed: false });
        continue;
      }
      const id = (uploadIdRef.current += 1);
      const controller = new AbortController();
      setUploading((current) => [
        ...current,
        { id, name: file.name, percent: 0, controller },
      ]);
      uploadMutate(
        {
          file,
          signal: controller.signal,
          onProgress: (sent, total) => {
            const percent =
              total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
            // The updater returns its EXACT input when the whole percent has
            // not moved, so a hundred progress events cost at most a hundred
            // renders of this small subtree — never one per packet under the
            // reader's cursor while they are typing.
            setUploading((current) => {
              const entry = current.find((row) => row.id === id);
              if (!entry || entry.percent === percent) return current;
              return current.map((row) =>
                row.id === id ? { ...row, percent } : row,
              );
            });
          },
        },
        {
          onSuccess: () =>
            setNotice({
              tone: 'done',
              text: `${file.name} was added to this channel's files.`,
              landed: true,
            }),
          onError: (error) => {
            // Asked for: the row simply leaves. Reporting a "failure" the
            // reader caused on purpose would be the app arguing with them.
            if (cancelledUploadsRef.current.delete(id)) return;
            setNotice({
              tone: 'failure',
              text: `${file.name} — ${extractApiError(error).message}`,
              landed: false,
            });
          },
          onSettled: () =>
            setUploading((current) => current.filter((entry) => entry.id !== id)),
        },
      );
    }
  };

  const cancelUpload = (entry: PendingUpload) => {
    cancelledUploadsRef.current.add(entry.id);
    entry.controller.abort();
  };

  const handleSend = () => {
    const content = value.trim();
    if (!content || content.length > MESSAGE_MAX_LENGTH) return;

    send.mutate(
      {
        content,
        replyToUuid: replyTo?.uuid ?? null,
        replyToPreview: replyTo ? toReplyPreview(replyTo) : null,
      },
      {
        onSuccess: (response) => {
          onSentSuccess(response.data.uuid);
          // The `ai` block exists only when @lawexa was summoned; a blocked /
          // errored summon is PRIVATE to the summoner (§F.12) — an inline
          // notice here, never a toast, never a feed row.
          const ai = response.data.ai;
          if (ai && ai.status !== 'dispatched') {
            setAiNotice(
              ai.status === 'blocked'
                ? (ai.reason?.message ?? 'You have reached your AI usage limit.')
                : "Something went wrong starting Lawexa's response. Mention @lawexa again to retry.",
            );
          }
        },
      },
    );
    setValue('');
    setMention(null);
    if (replyTo) onCancelReply();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter during IME composition confirms the composition — it must never
    // apply a mention or send the message (audit M5 — CJK input).
    if (event.key === 'Enter' && event.nativeEvent.isComposing) return;

    if (pickerOpen) {
      // Navigation and apply need something to land ON. The picker can be open
      // with no rows at all — showing only the can't-be-tagged line — and in
      // that state Enter must send the message like any other Enter.
      if (suggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex((index) => (index + 1) % suggestions.length);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex(
            (index) => (index - 1 + suggestions.length) % suggestions.length,
          );
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          applyMention(suggestions[activeIndex]);
          return;
        }
      }
      // Escape dismisses whatever the picker is showing — rows or a sentence.
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }

    if (event.key === 'Escape' && replyTo) {
      event.preventDefault();
      onCancelReply();
      return;
    }

    // Touch keyboards: Enter breaks; the send button posts (capability read
    // at event time — no subscription, no render-phase media query).
    const coarse = window.matchMedia('(hover: none)').matches;
    if (event.key === 'Enter' && !event.shiftKey && !coarse) {
      event.preventDefault();
      handleSend();
    }
  };

  const remaining = MESSAGE_MAX_LENGTH - value.length;
  const canSend = value.trim().length > 0 && remaining >= 0;
  const replyingToName = replyShown
    ? replyShown.is_ai
      ? 'Lawexa'
      : (replyShown.author?.name ?? 'Deleted member')
    : '';

  return (
    <ChatComposerShell
      typing={{ label: typingShown ?? '', visible: typing }}
      tray={
        <>
          {/* Mention autocomplete — floats above the whole tray. It opens for
              a line that has nothing to OFFER but something to SAY, which is
              the live state today: every row is a person with a handle, and
              everyone else is the sentence underneath. */}
          {pickerOpen && (
            <div
              className={cn(
                'absolute bottom-full left-0 z-20 mb-2 w-72 max-w-full overflow-hidden rounded-xl border bg-popover shadow-md',
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1',
                'motion-safe:duration-150',
              )}
            >
              {suggestions.length > 0 && (
                <ul role="listbox" aria-label="Mention someone">
                  {suggestions.map((candidate, index) => (
                    <li
                      key={candidate.key}
                      role="option"
                      aria-selected={index === activeIndex}
                    >
                      <button
                        type="button"
                        // Fire before the textarea blurs so the insertion lands.
                        onMouseDown={(event) => {
                          event.preventDefault();
                          applyMention(candidate);
                        }}
                        onPointerEnter={() => setActiveIndex(index)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                          index === activeIndex && 'bg-accent',
                        )}
                      >
                        {candidate.user === null ? (
                          <LawexaAvatar size="sm" />
                        ) : (
                          <MemberAvatar user={candidate.user} size="sm" />
                        )}
                        <span className="truncate">{candidate.name}</span>
                        {/* The handle is what separates two people with one
                            name — the reason this row has a second column. */}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          @{candidate.handle}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {untaggable !== '' && (
                <p
                  className={cn(
                    'px-3 py-2 text-xs text-muted-foreground',
                    suggestions.length > 0 && 'border-t',
                  )}
                >
                  {untaggable}
                </p>
              )}
            </div>
          )}

          <ComposerTrayRow open={aiNotice !== null}>
            <ComposerNotice
              tone="failure"
              text={
                <>
                  <span className="font-medium">Lawexa couldn&rsquo;t respond.</span>{' '}
                  {aiNoticeShown}
                </>
              }
              onDismiss={() => setAiNotice(null)}
            />
          </ComposerTrayRow>

          <ComposerTrayRow open={notice !== null}>
            <ComposerNotice
              tone={noticeShown?.tone ?? 'done'}
              text={noticeShown?.text ?? ''}
              action={
                noticeShown?.landed ? (
                  <button
                    type="button"
                    onClick={onOpenFiles}
                    className={cn(
                      'shrink-0 rounded font-medium text-primary underline underline-offset-2',
                      FOCUS_RING,
                    )}
                  >
                    Files
                  </button>
                ) : undefined
              }
              onDismiss={() => setNotice(null)}
            />
          </ComposerTrayRow>

          {/* In-flight uploads, with the real figure and a real way out. The
              fill is `aria-hidden` and carries no `role="progressbar"`: that
              role is on ARIA's presentational-children list, so putting it on
              the chip would delete the Cancel button inside it — the same trap
              the unread divider had to be moved off `role="separator"` for. The
              percentage is plain text, which every reader gets. */}
          <ComposerTrayRow open={uploading.length > 0}>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
              {uploading.map((entry) => (
                <span
                  key={entry.id}
                  className="relative inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-full border py-0.5 pr-1 pl-2"
                >
                  <span
                    aria-hidden
                    style={{ width: `${entry.percent}%` }}
                    className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-200 ease-out motion-reduce:transition-none"
                  />
                  <Paperclip aria-hidden className="relative size-3 shrink-0" />
                  <span className="relative min-w-0 truncate">{entry.name}</span>
                  <span className="relative shrink-0 tabular-nums text-muted-foreground/70">
                    {entry.percent}%
                  </span>
                  <button
                    type="button"
                    onClick={() => cancelUpload(entry)}
                    aria-label={`Cancel uploading ${entry.name}`}
                    title="Cancel"
                    className={cn(
                      'v2-interactive relative flex size-5 shrink-0 items-center justify-center rounded-full',
                      'text-muted-foreground transition-colors duration-150',
                      'hover:bg-secondary hover:text-foreground motion-reduce:transition-none',
                      FOCUS_RING,
                    )}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </ComposerTrayRow>

          {/* Reply staging bar — symmetric collapse, last content held. */}
          <ComposerTrayRow open={replyTo !== null}>
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
              <CornerUpLeft aria-hidden className="size-3.5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-muted-foreground">
                Replying to{' '}
                <span className="font-medium text-foreground">{replyingToName}</span>
                {replyShown ? ` — ${replyShown.content}` : ''}
              </p>
              <button
                type="button"
                onClick={onCancelReply}
                aria-label="Cancel reply"
                className={cn(
                  'shrink-0 rounded text-muted-foreground hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          </ComposerTrayRow>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => {
          attachFiles(event.target.files);
          // Let the same file be chosen twice in a row.
          event.target.value = '';
        }}
      />

      <ComposerAction
        label="Attach a file"
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip aria-hidden className="size-4" />
      </ComposerAction>

      <ComposerAction
        label="Mention someone"
        onClick={() => insertAtCaret('@', { spaceGuard: true, thenDetect: true })}
      >
        <AtSign aria-hidden className="size-4" />
      </ComposerAction>

      <EmojiInsert onPick={(emoji) => insertAtCaret(emoji)} />

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          detectMention(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
          );
          if (event.target.value.trim()) onTyping();
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder={`Message ${channel.name}`}
        aria-label={`Message ${channel.name}`}
        className="max-h-[200px] min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />

      {remaining <= COUNTER_AT && (
        <span
          aria-live="polite"
          className={cn(
            'shrink-0 self-center text-xs tabular-nums',
            remaining < 0 ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {remaining}
        </span>
      )}

      <Button
        type="button"
        size="icon"
        className="size-8 shrink-0 rounded-lg"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        title="Send message"
      >
        <SendHorizontal aria-hidden className="size-4" />
      </Button>
    </ChatComposerShell>
  );
}

/**
 * The emoji control — the curated {@link REACTION_TRAY}, inserted at the caret.
 * See the component docblock for why this is not `ReactionTrayRow`.
 */
function EmojiInsert({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Insert an emoji"
          title="Insert an emoji"
          className={COMPOSER_ACTION}
        >
          <Smile aria-hidden className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-auto rounded-2xl p-1"
      >
        <div role="group" aria-label="Insert an emoji" className="flex items-center gap-0.5">
          {REACTION_TRAY.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Insert ${emoji}`}
              onClick={() => {
                setOpen(false);
                onPick(emoji);
              }}
              className={cn(
                'v2-interactive flex size-8 items-center justify-center rounded-full text-lg',
                'transition-[background-color,transform] duration-150 motion-reduce:transition-none',
                'hover:bg-muted hover:scale-110 motion-reduce:hover:scale-100',
                FOCUS_RING,
              )}
            >
              <span aria-hidden className="leading-none">
                {emoji}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** ONE quiet line, never stacked bubbles (DIRECTION 7). */
function typingLabel(users: readonly TypingUser[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].name} is typing…`;
  if (users.length === 2) {
    return `${users[0].name} and ${users[1].name} are typing…`;
  }
  return 'Several people are typing…';
}
