'use client';

import { useState } from 'react';
import { Check, FileText, Loader2, Scale } from 'lucide-react';

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
  /** Server total of cases with pending work (from the summary endpoint). */
  casesPendingTotal: number | undefined;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onSelectCase: (caseId: number) => void;
}

/**
 * Search over ALL cases (there is no server-side text search on principles —
 * `search=` is accepted and silently ignored there), so a case is found by
 * name and opened by id. Selecting a case the queue has not reached yet is
 * fine: the pane loads it by case_id either way.
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
      onValueChange={(newValue) => {
        if (newValue) pick(Number(newValue));
      }}
    >
      <ComboboxInput
        placeholder="Find a case by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        showTrigger={false}
        className="w-full"
        aria-label="Find a case by name"
      />
      <ComboboxContent>
        <ComboboxList>
          {suggestions.map((caseItem) => (
            <ComboboxItem
              key={caseItem.id}
              value={String(caseItem.id)}
              onSelect={() => pick(caseItem.id)}
              className="flex items-start gap-2 py-2"
            >
              <FileText className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-tight">
                  {getCaseDisplayTitle(caseItem)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {caseItem.court &&
                    `${typeof caseItem.court === 'string' ? caseItem.court : caseItem.court.abbreviation} • `}
                  {caseItem.judgment_date || 'No date'}
                </span>
              </span>
            </ComboboxItem>
          ))}
          {!suggestions.length && (
            <ComboboxEmpty>
              {query ? 'No cases found' : 'Start typing to search all cases…'}
            </ComboboxEmpty>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/**
 * The queue as a list of cases, derived from the loaded queue prefix because
 * no endpoint lists cases with pending principles. Counts are only ever what
 * has actually been seen: a possibly-incomplete count renders with a trailing
 * "+" instead of pretending to be a total. Finished cases stay in place,
 * ticked, rather than being removed under the reader's eye.
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
    <div className="space-y-3">
      <CaseSearch onSelectCase={onSelectCase} />

      {isLoading ? (
        <div className="grid gap-1.5" aria-busy>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[54px] w-full rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
          No cases waiting for review
        </div>
      ) : (
        <nav aria-label="Cases with pending principles" className="grid gap-1.5">
          {entries.map((entry) => {
            const remaining = remainingInEntry(entry, session);
            const isActive = entry.caseRef.id === activeCaseId;
            const isDone = remaining === 0 && entry.countKnown;
            return (
              <button
                key={entry.caseRef.id}
                type="button"
                onClick={() => onSelectCase(entry.caseRef.id)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'group w-full rounded-lg border px-3 py-2 text-left',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-transparent hover:bg-muted'
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'min-w-0 text-sm leading-snug line-clamp-2',
                      isActive ? 'font-semibold text-foreground' : 'text-foreground/90',
                      isDone && 'text-muted-foreground'
                    )}
                  >
                    {getCaseDisplayTitle(entry.caseRef)}
                  </span>
                  {isDone ? (
                    <Check
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-label="Case finished"
                    />
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground/80">
                      {remaining}
                      {!entry.countKnown && '+'}
                    </span>
                  )}
                </span>
                {entry.caseRef.court && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Scale className="size-3 shrink-0" />
                    <span className="truncate">{entry.caseRef.court}</span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="px-1 text-xs text-muted-foreground">
            {hasMore
              ? `Showing ${entries.length} of ${
                  casesPendingTotal?.toLocaleString() ?? '…'
                } pending cases`
              : `All ${entries.length} loaded pending cases shown`}
          </p>
          {hasMore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore && <Loader2 className="animate-spin" />}
              Load more cases
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
