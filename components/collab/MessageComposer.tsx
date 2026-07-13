'use client';

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { extractApiError } from '@/lib/utils/api-error';
import { useChannelMembers, useSendMessage } from '@/lib/hooks/useCollab';
import type { SlimUser } from '@/types/collab';

import { MemberAvatar } from './MemberAvatar';

const MAX_LENGTH = 8000;
const MAX_SUGGESTIONS = 6;

interface MentionCandidate {
  key: string;
  name: string;
  handle: string;
  user: SlimUser | null;
}

interface MessageComposerProps {
  channelUuid: string;
  channelName: string;
  /** Called after a send is dispatched, so the reader can pin to the newest. */
  onSent?: () => void;
  /** Called on keystroke to emit a throttled typing whisper. */
  onTyping?: () => void;
}

/** Composer with @mention autocomplete, Enter-to-send and optimistic posting. */
export function MessageComposer({
  channelUuid,
  channelName,
  onSent,
  onTyping,
}: MessageComposerProps) {
  const [value, setValue] = useState('');
  const [mention, setMention] = useState<{ query: string; start: number } | null>(
    null
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  const send = useSendMessage(channelUuid);
  const membersQuery = useChannelMembers(channelUuid);

  const candidates = useMemo<MentionCandidate[]>(() => {
    const members: MentionCandidate[] = (membersQuery.data?.data ?? [])
      .filter((member) => member.is_active)
      .map((member) => ({
        key: member.user.uuid,
        name: member.user.name,
        handle: member.user.name.toLowerCase().replace(/\s+/g, '.'),
        user: member.user,
      }));
    members.push({ key: 'lawexa', name: 'Lawexa', handle: 'lawexa', user: null });
    return members;
  }, [membersQuery.data]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query;
    return candidates
      .filter(
        (candidate) =>
          candidate.handle.includes(query) ||
          candidate.name.toLowerCase().includes(query)
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [mention, candidates]);

  // Auto-grow the textarea up to a cap, then scroll internally.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const detectMention = (nextValue: string, caret: number) => {
    const upToCaret = nextValue.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([a-z0-9._]*)$/i);
    if (match) {
      setMention({
        query: match[1].toLowerCase(),
        start: caret - match[1].length - 1,
      });
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

  // Plus action: drop an "@" at the caret (space-guarded) and open the picker.
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
    if (!content || send.isPending) return;

    send.mutate(
      { content },
      {
        onSuccess: (response) => {
          // The human message always posts; the `ai` block only appears when
          // `@lawexa` was mentioned. Surface a dispatch failure privately to the
          // summoner — a running turn is signalled by the responding pill.
          const ai = response.data.ai;
          if (!ai) return;
          if (ai.status === 'blocked') {
            toast.error("Lawexa couldn't respond", {
              description:
                ai.reason?.message ?? 'You have reached your AI usage limit.',
            });
          } else if (ai.status === 'error') {
            toast.error("Lawexa couldn't respond", {
              description:
                'Something went wrong starting the response. Please try again.',
            });
          }
        },
        onError: (error) => {
          setValue(content);
          toast.error('Message not sent', {
            description: extractApiError(error).message,
          });
        },
      }
    );
    setValue('');
    setMention(null);
    onSent?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
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

    // On touch devices Enter inserts a newline; the Send button posts instead.
    if (event.key === 'Enter' && !event.shiftKey && !isMobile) {
      event.preventDefault();
      handleSend();
    }
  };

  const remaining = MAX_LENGTH - value.length;
  const canSend = value.trim().length > 0 && !send.isPending;

  return (
    <div className="pointer-events-none px-4 pb-4 pt-2">
      <div className="pointer-events-auto relative mx-auto max-w-xs sm:max-w-md">
        {mention && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-xl border bg-popover shadow-md">
            {suggestions.map((candidate, i) => (
              <button
                key={candidate.key}
                type="button"
                // Fire before the textarea blurs so the insertion still lands.
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyMention(candidate);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                  i === activeIndex && 'bg-accent'
                )}
              >
                <MemberAvatar user={candidate.user} size="sm" />
                <span className="truncate">{candidate.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  @{candidate.handle}
                </span>
              </button>
            ))}
          </div>
        )}

        <PromptInput
          value={value}
          onValueChange={setValue}
          onSubmit={handleSend}
          maxHeight={200}
          onClick={() => textareaRef.current?.focus()}
        >
          {/* Single row: + on the left, textarea in the middle, send on the
              right — sized to match the notes/cases composer height. */}
          <div className="flex items-center gap-1">
            <PromptInputAction tooltip="Mention someone">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 rounded-full text-primary hover:bg-primary/10 hover:text-primary"
                onClick={startMention}
                aria-label="Mention someone"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </PromptInputAction>

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                detectMention(
                  event.target.value,
                  event.target.selectionStart ?? event.target.value.length
                );
                if (event.target.value.trim()) onTyping?.();
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder={`Message #${channelName}`}
              className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />

            {remaining <= 500 && (
              <span
                className={cn(
                  'shrink-0 self-center text-xs tabular-nums',
                  remaining < 0 ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {remaining}
              </span>
            )}

            <PromptInputAction tooltip="Send message">
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send message"
              >
                {send.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </PromptInputAction>
          </div>
        </PromptInput>
      </div>
    </div>
  );
}
