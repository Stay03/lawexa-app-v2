'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * ChipsField — the keyboard-first free-text chips control (topics, keywords).
 *
 * v1's `ChipZone` was a role-less click-to-reveal div: the input only existed
 * after a mouse click, chips were Badges with unfocusable-looking `X`s, and a
 * screen reader heard none of it change. The v2 rules, from the study +
 * APG guidance:
 *
 *  - THE INPUT IS ALWAYS THERE. Tab lands in it and typing starts
 *    immediately — no click-to-arm step.
 *  - Enter or comma commits; a comma/semicolon paste splits into chips;
 *    Backspace in an empty input removes the last chip; Escape clears the
 *    draft.
 *  - ROVING DELETE: ArrowLeft from an empty input walks into the chip row;
 *    ArrowLeft/ArrowRight move between chips; Delete/Backspace (or
 *    Enter/Space on the chip's remove button) removes the focused chip and
 *    focus lands on its neighbour, never on `<body>`.
 *  - EVERY add and remove is ANNOUNCED through one polite live region.
 *
 * Duplicates are dropped case-insensitively on commit; entries are trimmed
 * and capped at `maxItemLength`; the whole field caps at `maxItems` with the
 * cap stated in place of the input.
 */
export function ChipsField({
  id,
  value,
  onChange,
  itemNoun,
  placeholder,
  maxItems,
  maxItemLength,
  describedBy,
  invalid = false,
}: {
  /** The input's id, so the field's visible label can point at it. */
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Singular noun for announcements and the capacity notice, e.g. "topic". */
  itemNoun: string;
  placeholder: string;
  maxItems: number;
  maxItemLength: number;
  /** The error/hint element id for `aria-describedby`. */
  describedBy?: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const atCapacity = value.length >= maxItems;

  /**
   * Commit entries, HONESTLY: additions are computed after the cap and after
   * per-item truncation, and the announcement narrates what actually
   * happened — never "Added 5" when only 2 fit (a 5-item paste into 2 free
   * slots adds 2 and says so, including how many were shortened).
   */
  const commitItems = (rawItems: string[]) => {
    const space = maxItems - value.length;
    const existing = new Set(value.map((item) => item.toLowerCase()));
    const additions: string[] = [];
    let truncated = 0;
    let overCap = 0;
    for (const raw of rawItems) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const item = trimmed.slice(0, maxItemLength);
      if (existing.has(item.toLowerCase())) continue;
      if (additions.length >= space) {
        overCap += 1;
        continue;
      }
      if (item.length < trimmed.length) truncated += 1;
      existing.add(item.toLowerCase());
      additions.push(item);
    }

    if (additions.length > 0) {
      onChange([...value, ...additions]);
    }

    const parts: string[] = [];
    if (additions.length === 1) parts.push(`Added ${additions[0]}`);
    else if (additions.length > 1) {
      parts.push(`Added ${additions.length} ${itemNoun}s`);
    }
    if (overCap > 0) {
      parts.push(
        additions.length === 0
          ? `Limit of ${maxItems} ${itemNoun}s reached — nothing added`
          : `${overCap} over the limit of ${maxItems} not added`,
      );
    }
    if (truncated > 0) {
      parts.push(
        `${truncated} shortened to ${maxItemLength} characters`,
      );
    }
    if (parts.length > 0) setAnnouncement(parts.join('. '));
    setDraft('');
  };

  const removeItem = (item: string, focusAfter: 'input' | 'neighbour') => {
    const index = value.indexOf(item);
    const next = value.filter((existing) => existing !== item);
    onChange(next);
    setAnnouncement(`Removed ${item}`);
    // rAF defers both focus moves past React's commit — the neighbour chip
    // needs its post-removal position, and the input may only be re-shown by
    // this very removal (the at-capacity state hides it).
    if (focusAfter === 'neighbour' && next.length > 0) {
      const neighbour = next[Math.min(index, next.length - 1)];
      requestAnimationFrame(() => {
        chipRefs.current.get(neighbour)?.focus();
      });
    } else {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  const focusChip = (index: number) => {
    const item = value[index];
    if (item) chipRefs.current.get(item)?.focus();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // An Enter (or comma) during IME composition is selecting the composed
    // text, not submitting — committing then would destroy the composition.
    if (event.nativeEvent.isComposing) return;
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault();
      commitItems([draft]);
    } else if (event.key === 'Escape' && draft) {
      event.preventDefault();
      setDraft('');
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      removeItem(value[value.length - 1], 'input');
    } else if (event.key === 'ArrowLeft' && !draft && value.length > 0) {
      event.preventDefault();
      focusChip(value.length - 1);
    }
  };

  const onChipKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        focusChip(Math.max(0, index - 1));
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (index === value.length - 1) inputRef.current?.focus();
        else focusChip(index + 1);
        break;
      case 'Backspace':
      case 'Delete':
        event.preventDefault();
        removeItem(value[index], 'neighbour');
        break;
    }
  };

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (pasted.includes(',') || pasted.includes(';')) {
      event.preventDefault();
      commitItems(pasted.split(/[,;]/));
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        'flex min-h-11 w-full cursor-text flex-wrap content-center items-center gap-1.5 rounded-xl border bg-input/30 px-2.5 py-2 transition-colors focus-within:border-ring',
        invalid ? 'border-destructive/60' : 'border-input',
      )}
    >
      {value.map((item, index) => (
        <button
          key={item}
          ref={(node) => {
            if (node) chipRefs.current.set(item, node);
            else chipRefs.current.delete(item);
          }}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            removeItem(item, 'input');
          }}
          onKeyDown={(event) => onChipKeyDown(event, index)}
          aria-label={`Remove ${item}`}
          className={cn(
            'v2-interactive inline-flex min-h-6 max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
            FOCUS_RING,
          )}
        >
          <span className="truncate">{item}</span>
          <X aria-hidden className="size-3 shrink-0" />
        </button>
      ))}

      {/* The input stays MOUNTED at capacity (disabled) so the field's label
          always points at a real control; the cap note says why it is off. */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onInputKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (draft.trim()) commitItems([draft]);
        }}
        placeholder={value.length === 0 ? placeholder : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={atCapacity}
        autoComplete="off"
        className={cn(
          'h-6 min-w-32 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground',
          atCapacity && 'hidden',
        )}
      />
      {atCapacity ? (
        <span className="px-1 text-xs text-muted-foreground">
          Limit of {maxItems} {itemNoun}s reached
        </span>
      ) : null}

      {/* One polite channel for every add/remove — invisible, but a screen
          reader hears the field change as it changes. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
