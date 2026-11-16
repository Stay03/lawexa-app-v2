'use client';

import { useId, useState } from 'react';

import { cn } from '@/lib/utils';
import { LawexaAvatar } from '@/v2/features/channels/ui/avatars';
import type { MentionCandidate, MentionOptions } from '@/v2/features/channels/model';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { applyMention, mentionQueryAt, mentionSuggestions, untaggableFor, type MentionQuery } from './mention-options';

/**
 * The `@` picker of a Space's boxes, ONE for both: the open chat's
 * (`ConversationComposer`) and the Space page's, which starts a new chat
 * (`HomeComposer` in `SpaceChatDock`; Arthur, 16 November 2026: "this @
 * doesn't work in the main space composer"). The rules are mention-options.ts;
 * this is the box's half: the `@` read at the caret, the arrows, Enter and Tab
 * to pick, Escape to put it away, and the list.
 *
 * `options` null means no picker: the box is not in a Space, and the textarea
 * gets no combobox role.
 */
export function useMentionPicker({
  options,
  value,
  setValue,
  textarea,
}: {
  options: MentionOptions | null;
  value: string;
  setValue: (next: string) => void;
  textarea: () => HTMLTextAreaElement | null;
}) {
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // The picker is a combobox: the box owns the list, and the highlighted person
  // is announced through `aria-activedescendant` as the arrows move it.
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;
  const suggestions = mention && options ? mentionSuggestions(options, mention.query) : [];
  const untaggable = mention && options ? untaggableFor(options, mention.query) : '';
  const open = mention !== null && (suggestions.length > 0 || untaggable !== '');

  /** The `@` the caret ends, read again when the caret moves without typing
   *  (arrows, Home and End, a click): a picker left open there would take Enter. */
  const detect = (text: string, caret: number) => {
    if (!options) return;
    const next = mentionQueryAt(text, caret);
    setMention((current) => (current?.start === next?.start && current?.query === next?.query ? current : next));
  };

  const pick = (candidate: MentionCandidate) => {
    if (!mention) return;
    const next = applyMention(value, mention, candidate.handle);
    setValue(next.value);
    setMention(null);
    requestAnimationFrame(() => {
      const el = textarea();
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an IME composes confirms the composition, nothing else.
    if (!open || event.nativeEvent.isComposing) return;
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pick(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
        return;
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setMention(null);
    }
  };

  return {
    open,
    suggestions,
    untaggable,
    activeIndex,
    setActiveIndex,
    listId,
    optionId,
    pick,
    close: () => setMention(null),
    /** Called with the box's new text as it is typed. */
    typed: (next: string) => {
      if (!options) return;
      detect(next, textarea()?.selectionStart ?? next.length);
      setActiveIndex(0);
    },
    /** For the textarea: before the pill's own Enter-to-send (prompt-input.tsx),
     *  so a picked person takes Enter and Tab instead of sending. */
    textareaProps: {
      onKeyDown,
      // A caret moved without typing reads the `@` there again.
      onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) =>
        detect(event.currentTarget.value, event.currentTarget.selectionStart),
      // Leaving the box puts the picker away.
      onBlur: () => setMention(null),
      ...(options && {
        role: 'combobox',
        'aria-autocomplete': 'list' as const,
        'aria-haspopup': 'listbox' as const,
        'aria-expanded': open,
        'aria-controls': listId,
        'aria-activedescendant':
          open && suggestions.length > 0 ? optionId(Math.min(activeIndex, suggestions.length - 1)) : undefined,
      }),
    },
  };
}

export type MentionPicker = ReturnType<typeof useMentionPicker>;

/**
 * The list: floats above the whole box, as the channel composer's does. The
 * people the typed `@` matches, and one line for those it names who cannot be
 * tagged. A row is chosen on mouse-down, before the box loses focus, so the
 * handle lands where the caret was. The box's own wrapper is `relative`.
 */
export function MentionList({ picker }: { picker: MentionPicker }) {
  if (!picker.open) return null;
  const { suggestions, untaggable, activeIndex } = picker;
  return (
    <div
      className={cn(
        'bg-popover absolute right-4 bottom-full left-4 z-20 mb-1 max-w-72 overflow-hidden rounded-xl border shadow-md',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150',
      )}
    >
      {suggestions.length > 0 && (
        <ul id={picker.listId} role="listbox" aria-label="Mention someone">
          {suggestions.map((candidate, index) => (
            // The option itself takes the press (no button inside an
            // option), on mouse-down so the box keeps its focus.
            <li
              key={candidate.key}
              id={picker.optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                picker.pick(candidate);
              }}
              onPointerEnter={() => picker.setActiveIndex(index)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm',
                index === activeIndex && 'bg-accent',
              )}
            >
              {/* Lawexa wears its own mark, as in a channel's picker. */}
              {candidate.user === null ? (
                <LawexaAvatar size="sm" className="size-6 shrink-0" />
              ) : (
                <MemberAvatar user={candidate.user} className="size-6 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">@{candidate.handle}</span>
            </li>
          ))}
        </ul>
      )}
      {untaggable !== '' && (
        <p className={cn('text-muted-foreground px-3 py-2 text-xs', suggestions.length > 0 && 'border-t')}>
          {untaggable}
        </p>
      )}
    </div>
  );
}
