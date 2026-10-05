'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatCount, pageSummary, pagerItems } from './pager-model';

/** Every pager button: a ≥44px target on a phone, the denser 36px from `md:`. */
const PAGE_BUTTON = 'h-11 min-w-11 px-2 tabular-nums md:h-9 md:min-w-9';

/**
 * Pager — the numbered pager under a paged list: "Page 3 of 1,756" on one
 * side, first / previous / the page numbers / next / last on the other.
 *
 * The page numbers come from `pagerItems` (see `pager-model.ts`): the first
 * and last pages, the current page with one page either side, gaps for the
 * rest. Below `md:` the row narrows to fit a 390px phone: the first and last
 * buttons go (page 1 and the last page are already in the numbers) and the
 * current page stands alone between the ends.
 *
 * `page` is the page the reader ASKED for, so the pager moves the moment they
 * press, while the rows for it may still be loading. `busy` shows that wait as
 * a small spinner beside the page line; nothing else moves.
 */
export function Pager({
  page,
  lastPage,
  onPageChange,
  busy = false,
  className,
}: {
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  busy?: boolean;
  className?: string;
}) {
  if (lastPage < 1) return null;
  const current = Math.min(Math.max(page, 1), lastPage);
  const atStart = current <= 1;
  const atEnd = current >= lastPage;

  return (
    <nav
      aria-label="Pages"
      className={cn(
        'flex flex-col items-center gap-2 md:flex-row md:justify-between md:gap-4',
        className,
      )}
    >
      <p className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
        {pageSummary(current, lastPage)}
        <Loader2
          aria-hidden
          className={cn(
            'size-3.5 transition-opacity duration-200 motion-safe:animate-spin',
            busy ? 'opacity-100' : 'opacity-0',
          )}
        />
        {busy ? <span className="sr-only">Loading</span> : null}
      </p>

      <ul className="flex items-center gap-1">
        <li className="hidden md:block">
          <Button
            variant="ghost"
            size="icon"
            className={PAGE_BUTTON}
            disabled={atStart}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <ChevronsLeft aria-hidden />
          </Button>
        </li>
        <li>
          <Button
            variant="ghost"
            size="icon"
            className={PAGE_BUTTON}
            disabled={atStart}
            onClick={() => onPageChange(current - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft aria-hidden />
          </Button>
        </li>

        <PageNumbers
          current={current}
          lastPage={lastPage}
          siblings={1}
          onPageChange={onPageChange}
          className="hidden md:contents"
        />
        <PageNumbers
          current={current}
          lastPage={lastPage}
          siblings={0}
          onPageChange={onPageChange}
          className="contents md:hidden"
        />

        <li>
          <Button
            variant="ghost"
            size="icon"
            className={PAGE_BUTTON}
            disabled={atEnd}
            onClick={() => onPageChange(current + 1)}
            aria-label="Next page"
          >
            <ChevronRight aria-hidden />
          </Button>
        </li>
        <li className="hidden md:block">
          <Button
            variant="ghost"
            size="icon"
            className={PAGE_BUTTON}
            disabled={atEnd}
            onClick={() => onPageChange(lastPage)}
            aria-label="Last page"
          >
            <ChevronsRight aria-hidden />
          </Button>
        </li>
      </ul>
    </nav>
  );
}

/**
 * The page numbers and gaps, as list items. Two of these render, one per
 * width; `display: contents` on the wrapper keeps their items in the parent's
 * flex row, and `hidden` takes the other width's set out of the
 * accessibility tree as well as off the screen.
 */
function PageNumbers({
  current,
  lastPage,
  siblings,
  onPageChange,
  className,
}: {
  current: number;
  lastPage: number;
  siblings: number;
  onPageChange: (page: number) => void;
  className: string;
}) {
  return (
    <li className={className}>
      <ul className="contents">
        {pagerItems(current, lastPage, siblings).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <Button
                variant={item === current ? 'outline' : 'ghost'}
                size="sm"
                className={cn(PAGE_BUTTON, item === current && 'font-semibold text-foreground')}
                aria-current={item === current ? 'page' : undefined}
                aria-label={`Page ${item}`}
                onClick={() => {
                  if (item !== current) onPageChange(item);
                }}
              >
                {formatCount(item)}
              </Button>
            </li>
          ) : (
            <li
              key={item}
              aria-hidden
              className="flex h-11 min-w-6 items-center justify-center text-sm text-muted-foreground md:h-9"
            >
              &hellip;
            </li>
          ),
        )}
      </ul>
    </li>
  );
}
