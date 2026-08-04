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
import { AlertCircle, ArrowUp, AtSign, CornerUpLeft, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PromptInput, PromptInputAction } from '@/components/ui/prompt-input';
import type { Channel, Message, MessageReplyTo } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useSendChannelMessage } from '../message-mutations';
import {
  buildMentionCandidates,
  MESSAGE_MAX_LENGTH,
  type MentionCandidate,
} from '../model';
import { channelsQueries } from '../queries';
import { MemberAvatar, LawexaAvatar } from '../ui/avatars';

/**
 * ChannelComposer — the channel's floating pill in the house grammar (the
 * conversation composer's compact scale: round accent button left, auto-grow
 * textarea, round send right), with the channel-specific staging tray ABOVE
 * the pill: the reply quote bar and the private Lawexa-blocked notice.
 * Phase-5 W2; sources: plan W2 item 4, study A4 (mention autocomplete KEEP,
 * incl. the synthetic `lawexa` candidate), foundation-standards §5 (send
 * states, typing throttle), design-research DIRECTIONS 4/9/12 — 2026-08-04.
 *
 * SEND is optimistic and NON-BLOCKING: the input clears immediately, the row
 * appears as `sending`, and a failure surfaces ON THE ROW (Retry/Discard —
 * never a rollback, never a toast). The composer never disables while a send
 * is in flight — Discord-fluid, and §5's ladder makes it safe.
 *
 * REPLY (DIRECTION 4): one staged quote bar above the pill, cancel with one
 * tap or Escape; sends `reply_to_uuid` and pre-builds the optimistic row's
 * quote so it renders before the server echoes. The bar collapses with a
 * symmetric grid-rows tween (no abrupt appear/disappear), holding its last
 * content through the exit so it never flashes empty.
 *
 * MENTIONS: `@` triggers the roster autocomplete (dotted handles, the
 * server-resolvable form — §F.15) plus the synthetic Lawexa candidate;
 * ArrowUp/Down navigate, Enter/Tab apply, Escape dismisses. The AtSign
 * button drops an `@` at the caret and opens the picker (v1's affordance).
 *
 * KEYBOARD: Enter sends / Shift+Enter breaks on precise-pointer setups; on
 * touch (`hover: none`, read at event time) Enter breaks and the send button
 * posts — the v1 contract, kept. The pill rides the keyboard through the
 * shell's dvh + `--keyboard-inset` region (never `position: fixed`).
 */

const MAX_SUGGESTIONS = 6;

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
  /** A send was ACCEPTED by the server — the screen advances the read
   *  pointer with the new uuid (§5's send trigger). */
  onSentSuccess: (serverUuid: string) => void;
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

export function ChannelComposer({
  channel,
  viewerId,
  replyTo,
  onCancelReply,
  onTyping,
  onSentSuccess,
  ref,
}: ChannelComposerProps) {
  const [value, setValue] = useState('');
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const send = useSendChannelMessage(channel.uuid);
  const membersQuery = useQuery({
    ...channelsQueries.members(channel.uuid, { viewerId }),
    enabled: channel.is_member === true,
  });

  // Auto-grow the textarea to a cap, then scroll internally — a DOM height
  // write (no state), the same mechanism the PromptInputTextarea primitive
  // uses; a raw textarea is needed here for the caret-aware mention parsing.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const candidates = useMemo(
    () => buildMentionCandidates(membersQuery.data?.data ?? []),
    [membersQuery.data],
  );

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query;
    return candidates
      .filter(
        (candidate) =>
          candidate.handle.includes(query) ||
          candidate.name.toLowerCase().includes(query),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [mention, candidates]);

  // Hold the exiting reply bar's content so the collapse never reads empty
  // (React's sanctioned guarded render-adjust — the NewRowsPill idiom).
  const [lastReply, setLastReply] = useState<Message | null>(null);
  if (replyTo !== null && replyTo !== lastReply) setLastReply(replyTo);
  const replyShown = replyTo ?? lastReply;

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

  // The AtSign action: drop an `@` at the caret (space-guarded) + open picker.
  const startMention = () => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const inserted = needsSpace ? ' @' : '@';
    const nextValue = before + inserted + value.slice(caret);
    const nextCaret = caret + inserted.length;
    setValue(nextValue);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (node) {
        node.focus();
        node.setSelectionRange(nextCaret, nextCaret);
      }
      detectMention(nextValue, nextCaret);
    });
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

    if (mention && suggestions.length > 0) {
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
    <div className="mx-auto w-full max-w-xs px-4 pb-3 sm:max-w-md">
      <div className="relative">
        {/* Mention autocomplete — floats above the staging tray. */}
        {mention && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-20 mb-2 w-72 max-w-full overflow-hidden rounded-xl border bg-popover shadow-md">
            <ul role="listbox" aria-label="Mention someone">
              {suggestions.map((candidate, index) => (
                <li key={candidate.key} role="option" aria-selected={index === activeIndex}>
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
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      @{candidate.handle}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lawexa-blocked notice — inline, persistent until dismissed. */}
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity,margin] duration-200 motion-reduce:transition-none',
            aiNotice ? 'mb-2 grid-rows-[1fr] opacity-100' : 'mb-0 grid-rows-[0fr] opacity-0',
          )}
          aria-hidden={!aiNotice}
        >
          <div className="overflow-hidden">
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-background px-3 py-2 text-xs">
              <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <p className="flex-1 text-destructive">
                <span className="font-medium">Lawexa couldn&rsquo;t respond.</span>{' '}
                {aiNotice}
              </p>
              <button
                type="button"
                inert={!aiNotice}
                onClick={() => setAiNotice(null)}
                aria-label="Dismiss"
                className={cn('rounded text-muted-foreground hover:text-foreground', FOCUS_RING)}
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Reply staging bar — symmetric collapse, last content held. */}
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity,margin] duration-200 motion-reduce:transition-none',
            replyTo ? 'mb-2 grid-rows-[1fr] opacity-100' : 'mb-0 grid-rows-[0fr] opacity-0',
          )}
          aria-hidden={!replyTo}
        >
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
              <CornerUpLeft aria-hidden className="size-3.5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-muted-foreground">
                Replying to{' '}
                <span className="font-medium text-foreground">{replyingToName}</span>
                {replyShown ? ` — ${replyShown.content}` : ''}
              </p>
              <button
                type="button"
                inert={!replyTo}
                onClick={onCancelReply}
                aria-label="Cancel reply"
                className={cn('rounded text-muted-foreground hover:text-foreground', FOCUS_RING)}
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <PromptInput
          value={value}
          onValueChange={setValue}
          onSubmit={handleSend}
          maxHeight={200}
          onClick={() => textareaRef.current?.focus()}
        >
          <div className="flex items-end gap-1">
            <PromptInputAction tooltip="Mention someone">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0 rounded-full text-primary hover:bg-primary/10 hover:text-primary"
                onClick={startMention}
                aria-label="Mention someone"
              >
                <AtSign aria-hidden className="size-4" />
              </Button>
            </PromptInputAction>

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
              className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />

            {remaining <= 500 && (
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

            <PromptInputAction tooltip="Send message">
              <Button
                type="button"
                size="icon"
                className="size-8 shrink-0 rounded-full"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send message"
              >
                <ArrowUp aria-hidden className="size-4" />
              </Button>
            </PromptInputAction>
          </div>
        </PromptInput>
      </div>
    </div>
  );
}
