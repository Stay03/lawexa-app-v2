'use client';

import { useState } from 'react';
import { Check, Loader2, Scale } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { useCases } from '@/lib/hooks/useAdminCases';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import { remainingInEntry, type RailCaseEntry, type ReviewSession } from './model';

interface CaseRailProps {
  entries: RailCaseEntry[];
  session: ReviewSession;
  activeCaseId: number | undefined;
  /** Server total of cases with pending work, from the summary endpoint. */
  casesPendingTotal: number | undefined;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onSelectCase: (caseId: number) => void;
}

/**
 * Search over all cases by name, because the queue is ordered by row and a
 * reviewer looking for a particular judgment has no other way in. Selecting a
 * case the queue has not reached is fine: the pane loads it by case_id.
 */
function CaseSearch({ onSelectCase }: { onSelectCase: (caseId: number) => void }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const query = debouncedSearch.trim();

  const { data: casesData } = useCases(
    { search: query, per_page: 20 },
    { enabled: query.length > 0 }
  );
  const suggestions = query ? casesData?.data ?? [] : [];

  const pick = (caseId: number) => {
    onSelectCase(caseId);
    setSearch('');
  };

  return (
    <Combobox
      value=""
      onValueChange={(next) => {
        if (next) pick(Number(next));
      }}
    >
      <ComboboxInput
        placeholder="Find a case by name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        showTrigger={false}
        className="w-full"
        aria-label="Find a case by name"
      />
      <ComboboxContent>
        <ComboboxList>
          {suggestions.map((row) => (
            <ComboboxItem
              key={row.id}
              value={String(row.id)}
              onSelect={() => pick(row.id)}
              className="py-2"
            >
              <span className="text-sm leading-tight">
                {getCaseDisplayTitle(row)}
              </span>
            </ComboboxItem>
          ))}
          {suggestions.length === 0 && (
            <ComboboxEmpty>
              {query ? 'No case matches that.' : 'Type to find a case.'}
            </ComboboxEmpty>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/**
 * The cases with arguments waiting, in the order the queue found them.
 *
 * ── THE COUNT SAYS WHAT IT COUNTS ─────────────────────────────────────────
 * The heading counts CASES and the number beside each row counts ARGUMENTS,
 * and both say so in words. A reviewer who has finished forty cases must never
 * have to work out whether "512 left" moved by forty or by three hundred.
 *
 * A trailing "+" means the queue has seen at least that many for the case but
 * has not loaded the page its remaining rows sit on. Opening the case fetches
 * the whole set and the number becomes exact.
 */
export function CaseRail({
  entries,
  session,
  activeCaseId,
  casesPendingTotal,
  isLoading,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onSelectCase,
}: CaseRailProps) {
  return (
    <aside className="flex min-h-0 flex-col gap-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">
          {casesPendingTotal === undefined
            ? 'Cases to review'
            : `${casesPendingTotal.toLocaleString()} cases to review`}
        </h2>
        <p className="text-xs text-muted-foreground">
          Each number is how many arguments that case still has waiting.
        </p>
      </div>

      <CaseSearch onSelectCase={onSelectCase} />

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}

        {!isLoading && entries.length === 0 && (
          <p className="px-1 py-6 text-sm text-muted-foreground">
            Nothing is waiting for review.
          </p>
        )}

        {entries.map((entry) => {
          const remaining = remainingInEntry(entry, session);
          const active = entry.caseRef.id === activeCaseId;
          const done = remaining === 0;
          return (
            <button
              key={entry.caseRef.id}
              type="button"
              onClick={() => onSelectCase(entry.caseRef.id)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left',
                'transition-colors duration-200 motion-reduce:transition-none',
                active ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted/60'
              )}
            >
              <Scale className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm leading-snug">
                  {getCaseDisplayTitle(entry.caseRef)}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 tabular-nums text-xs',
                  done ? 'text-muted-foreground' : 'font-medium'
                )}
              >
                {done ? (
                  <Check className="size-4" aria-label="Nothing left on this case" />
                ) : (
                  <>
                    {remaining}
                    {entry.countKnown ? '' : '+'}
                  </>
                )}
              </span>
            </button>
          );
        })}

        {hasMore && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                Loading
              </>
            ) : (
              'Show more cases'
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}
