'use client';

import { Fragment, type MouseEvent } from 'react';

import { cn } from '@/lib/utils';
import type { TemplateSegment } from '@/types/private-items';

/**
 * A template's text, as a page, with every blank drawn as a marked chip
 * (Arthur's pages, 19 November 2026). Paragraphs are the "\n\n" inside the
 * text segments (Backend's shape). Blanks come from `segments`, never from
 * guessing at square brackets, so "[2024] LPELR" stays text.
 *
 * `selected` marks one blank's chips more strongly; `onBlank` makes the chips
 * buttons (Check the blanks). `onSelectText` reports text the person selects,
 * so it can become a blank.
 */
export function TemplateDocument({
  segments,
  selected = null,
  onBlank,
  onSelectText,
  className,
}: {
  segments: readonly TemplateSegment[];
  selected?: string | null;
  onBlank?: (name: string) => void;
  onSelectText?: (text: string) => void;
  className?: string;
}) {
  const paragraphs = toParagraphs(segments);
  const reportSelection = (event: MouseEvent<HTMLDivElement>) => {
    if (!onSelectText) return;
    const text = window.getSelection()?.toString().trim() ?? '';
    if (text && event.currentTarget.contains(window.getSelection()?.anchorNode ?? null)) onSelectText(text);
  };
  return (
    <div
      onMouseUp={reportSelection}
      onTouchEnd={() => {
        const text = window.getSelection()?.toString().trim() ?? '';
        if (text && onSelectText) onSelectText(text);
      }}
      className={cn(
        'rounded-xl border border-border bg-background px-5 py-6 font-serif text-[15px] leading-[1.75] text-foreground shadow-xs sm:px-8 sm:py-8',
        className,
      )}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="mb-4 whitespace-pre-wrap last:mb-0">
          {paragraph.map((segment, part) =>
            segment.type === 'text' ? (
              <Fragment key={part}>{segment.text}</Fragment>
            ) : (
              <BlankChip key={part} name={segment.name} selected={selected === segment.name} onClick={onBlank} />
            ),
          )}
        </p>
      ))}
    </div>
  );
}

function BlankChip({ name, selected, onClick }: { name: string; selected: boolean; onClick?: (name: string) => void }) {
  const look = cn(
    'mx-0.5 inline rounded-md px-1.5 py-0.5 font-sans text-[12px] font-semibold tracking-wide whitespace-nowrap ring-1 ring-inset transition-colors',
    selected
      ? 'bg-primary text-primary-foreground ring-primary'
      : 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/40',
  );
  if (!onClick) return <span className={look}>{name}</span>;
  return (
    <button type="button" onClick={() => onClick(name)} aria-pressed={selected} className={cn(look, 'cursor-pointer hover:ring-primary')}>
      {name}
    </button>
  );
}

/** Split the segments into paragraphs at each "\n\n" inside the text. */
function toParagraphs(segments: readonly TemplateSegment[]): TemplateSegment[][] {
  const paragraphs: TemplateSegment[][] = [[]];
  for (const segment of segments) {
    if (segment.type === 'blank') {
      paragraphs[paragraphs.length - 1].push(segment);
      continue;
    }
    segment.text.split(/\n{2,}/).forEach((part, index) => {
      if (index > 0) paragraphs.push([]);
      if (part) paragraphs[paragraphs.length - 1].push({ type: 'text', text: part });
    });
  }
  return paragraphs.filter((paragraph) => paragraph.length > 0);
}
