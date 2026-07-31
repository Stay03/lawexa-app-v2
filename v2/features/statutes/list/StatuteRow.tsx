'use client';

import { memo } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { StatuteBookmarkButton } from '../bookmark/StatuteBookmarkButton';
import {
  statuteHref,
  statuteStatusTone,
  type StatuteRowModel,
  type StatuteStatusTone,
} from '../statute-row-model';

/**
 * StatuteRow — one statute in the library list, in the cases-row grammar:
 * the NAME at full weight, ONE quiet meta line, a two-line clamp of what the
 * Act is for, hairlines between rows and no box around them.
 *
 * How a lawyer picks a statute, in reading order:
 *   1. the TITLE ("Courts Act, 1993") — with the short designation
 *      ("Act 459") beside it in the meta, since practitioners cite both;
 *   2. the JURISDICTION — the flag + country name (same artwork as every
 *      other v2 surface), then the year;
 *   3. the STATUS — a dot + label, because "repealed" changes whether you may
 *      rely on the text at all. Dot AND word: never colour-only. `active` is
 *      the unremarkable default and stays muted; amended/repealed are tinted.
 *
 * `memo` matters here for the same reason as `CaseRow`: the bookmark mutation
 * fans out across every cached statute surface, so an unmemoised row would
 * re-render the whole visible list on each star press.
 */

const STATUS_DOT: Record<StatuteStatusTone, string> = {
  neutral: 'bg-muted-foreground/50',
  caution: 'bg-amber-500',
  negative: 'bg-red-500',
};

const STATUS_TEXT: Record<StatuteStatusTone, string> = {
  neutral: '',
  caution: 'text-amber-700 dark:text-amber-400',
  negative: 'text-red-700 dark:text-red-400',
};

/** The dot + label status mark the list row and the reader header share. */
export function StatuteStatusMark({
  tone,
  label,
}: {
  tone: StatuteStatusTone;
  label: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', STATUS_TEXT[tone])}>
      <span aria-hidden className={cn('size-1.5 rounded-full', STATUS_DOT[tone])} />
      {label}
    </span>
  );
}

export const StatuteRow = memo(function StatuteRow({
  row,
  index,
}: {
  row: StatuteRowModel;
  /** Staggers the entrance for the first screenful only. */
  index: number;
}) {
  const tone = statuteStatusTone(row.status);

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="group relative flex items-start gap-2">
        <Link
          href={statuteHref(row.slug)}
          className={cn(
            'v2-interactive min-w-0 flex-1 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/50',
            FOCUS_RING,
          )}
        >
          <h3 className="truncate text-[15px] font-medium text-foreground transition-colors group-hover:text-primary">
            {row.title}
          </h3>

          {/* One quiet meta line: the short designation first (a lawyer reads
              "Courts Act, 1993 · Act 459" as one citation unit), then flag +
              country, the year, and the status mark. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {row.shortTitle ? (
              <>
                <span>{row.shortTitle}</span>
                <Dot />
              </>
            ) : null}
            {row.countryCode || row.countryName ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  {row.countryCode ? (
                    <FlagIcon
                      code={row.countryCode}
                      title={row.countryName ?? undefined}
                    />
                  ) : null}
                  {row.countryName ? <span>{row.countryName}</span> : null}
                </span>
                <Dot />
              </>
            ) : null}
            <span className="tabular-nums">{row.year}</span>
            <Dot />
            <StatuteStatusMark tone={tone} label={row.statusLabel} />
          </p>

          {row.preview ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {row.preview}
            </p>
          ) : null}
        </Link>

        {/* Outside the link, so the star is its own control with its own
            accessible name rather than a click the row has to swallow —
            v1 nested this button INSIDE the row anchor (invalid HTML). */}
        <StatuteBookmarkButton
          statuteId={row.id}
          isBookmarked={row.isBookmarked}
          className="mt-2"
        />
      </div>
    </li>
  );
});

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}
