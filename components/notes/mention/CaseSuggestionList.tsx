'use client';

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { cn } from '@/lib/utils';
import type { CaseMentionAttrs, CaseWithMeta } from './caseSuggestion';
import { Scale, MapPin, Loader2 } from 'lucide-react';

export interface CaseSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

type CaseSuggestionListProps = SuggestionProps<CaseWithMeta, CaseMentionAttrs>;

export const CaseSuggestionList = forwardRef<
  CaseSuggestionListRef,
  CaseSuggestionListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter out marker items (items without id) - these are used for "no results" state
  const validItems = props.items.filter(item => item.id);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = validItems[index];
      if (item) {
        props.command({
          id: item.id,
          slug: item.slug,
          label: item.title,
        });
      }
    },
    [validItems, props]
  );

  // Expose keyboard handler to parent
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? validItems.length - 1 : prev - 1
        );
        return true;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev >= validItems.length - 1 ? 0 : prev + 1
        );
        return true;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  // Prompt for minimum characters
  if (props.query.length < 2) {
    return (
      <div className="bg-popover text-popover-foreground rounded-xl p-3 shadow-lg w-[320px]">
        <p className="text-sm text-muted-foreground text-center">
          Type at least 2 characters to search cases
        </p>
      </div>
    );
  }

  // No results yet - show loading spinner
  if (props.items.length === 0) {
    return (
      <div className="bg-popover text-popover-foreground rounded-xl p-4 shadow-lg w-[320px]">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Searching cases...</span>
        </div>
      </div>
    );
  }

  // Check if API returned total = 0 (marker item with __searchTotal = 0)
  const firstItem = props.items[0];
  if (firstItem.__searchTotal === 0 && !firstItem.id) {
    return (
      <div className="bg-popover text-popover-foreground rounded-xl p-3 shadow-lg w-[320px]">
        <p className="text-sm text-muted-foreground text-center">
          No cases found for &quot;{props.query}&quot;
        </p>
      </div>
    );
  }

  return (
    <div className="bg-popover text-popover-foreground rounded-xl shadow-lg w-[320px] flex flex-col max-h-[300px]">
      {/* Header */}
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground shrink-0">
        Cases
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1 p-1">
        {validItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}
            className={cn(
              'w-full text-left rounded-lg px-3 py-2 text-sm transition-colors',
              'flex flex-col gap-1',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted'
            )}
          >
            <span className="font-medium truncate" title={item.title}>
              {item.title}
            </span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {item.court && (
                <span className="flex items-center gap-1 truncate">
                  <Scale className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {item.court.abbreviation || item.court.name}
                  </span>
                </span>
              )}
              {item.country && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {item.country.abbreviation || item.country.name}
                  </span>
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Fixed footer with keyboard hints */}
      <div className="px-3 py-1.5 text-xs text-muted-foreground shrink-0 flex items-center justify-between bg-popover rounded-b-xl">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> select
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> cancel
        </span>
      </div>
    </div>
  );
});

CaseSuggestionList.displayName = 'CaseSuggestionList';
