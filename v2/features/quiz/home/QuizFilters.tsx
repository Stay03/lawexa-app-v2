'use client';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuizListFilterOptions, QuizListFilters } from '@/types/channel-quiz';
import type { UrlSearch } from '@/v2/runtime/use-url-search';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SearchField } from '@/v2/shell/SearchField';
import { hasFilterChoice, NO_QUIZ_FILTERS, QUIZ_LEVELS } from '../solo/home-model';

/**
 * QuizFilters — the Quiz home's search box and its three choices, topic,
 * level and year (Arthur's quiz list, part 5). One bar for both tabs: Explore
 * narrows the public list, My quizzes the reader's own.
 *
 * ── THE ADDRESS IS THE STATE ───────────────────────────────────────────────
 * `?search=`, `?topic=`, `?level=` and `?year=`, as every v2 list keeps its
 * filters, so a narrowed list is a link and Back leaves it as it was. The box
 * is `useUrlSearch`'s (debounced, race-free); a choice is written at once.
 *
 * ── THE CHOICES ARE THE SERVER'S ───────────────────────────────────────────
 * Each list answers with the years, levels and topics its quizzes use, over
 * the whole list rather than the page (`filters` beside the rows), so a
 * choice can never lead to an empty list. A choice with nothing to offer is
 * not drawn. The levels keep `QUIZ_LEVELS`' order; a topic the address names
 * in another spelling ("land law") is matched to the listed one.
 */

const ALL = '__all';

export function QuizFilters({
  search,
  filters,
  options,
}: {
  search: UrlSearch;
  filters: QuizListFilters;
  /** The latest page's choices; `undefined` before the first page, or from a
   *  server without them. */
  options: QuizListFilterOptions | undefined;
}) {
  const topics = topicChoices(options, filters.topic);
  const levels = QUIZ_LEVELS.filter(
    (level) => level === filters.level || options?.levels.some((choice) => choice.level === level),
  );
  const years = yearChoices(options, filters.year);
  const anyChoice = topics.length > 0 || levels.length > 0 || years.length > 0;

  return (
    <div className="mb-3 flex flex-col gap-2">
      <SearchField
        value={search.inputValue}
        onChange={search.onInputChange}
        onClear={search.onClear}
        placeholder="Search quizzes"
        label="Search quizzes by title, description or topic"
      />
      {anyChoice ? (
        <div role="group" aria-label="Filter quizzes" className="flex flex-wrap items-center gap-2">
          {topics.length > 0 ? (
            <FilterSelect
              label="Topic"
              allLabel="All topics"
              value={topics.find((topic) => sameTopic(topic, filters.topic)) ?? null}
              choices={topics.map((topic) => ({ value: topic, label: topic }))}
              onChange={(topic) => replaceUrlParams({ topic })}
            />
          ) : null}
          {levels.length > 0 ? (
            <FilterSelect
              label="Level"
              allLabel="All levels"
              value={filters.level ?? null}
              choices={levels.map((level) => ({ value: level, label: level }))}
              onChange={(level) => replaceUrlParams({ level })}
            />
          ) : null}
          {years.length > 0 ? (
            <FilterSelect
              label="Year"
              allLabel="All years"
              value={filters.year !== undefined ? String(filters.year) : null}
              choices={years.map((year) => ({ value: String(year), label: String(year) }))}
              onChange={(year) => replaceUrlParams({ year })}
            />
          ) : null}
          {hasFilterChoice(filters) ? (
            <button
              type="button"
              onClick={() => replaceUrlParams({ ...NO_QUIZ_FILTERS, search: filters.search ?? null })}
              className={cn(
                'v2-interactive inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <X aria-hidden className="size-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** One compact choice: its name while nothing is chosen, the choice after. */
function FilterSelect({
  label,
  allLabel,
  value,
  choices,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string | null;
  choices: readonly { value: string; label: string }[];
  /** `null` clears it. */
  onChange: (value: string | null) => void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
      <SelectTrigger
        size="sm"
        aria-label={value ? `${label}: ${value}` : `${label}: all`}
        className={cn(
          'h-9 max-w-[11rem] rounded-full text-xs font-medium',
          value ? 'border-primary/50 bg-primary/10 text-foreground' : 'text-muted-foreground',
        )}
      >
        {value ? <SelectValue /> : <span>{label}</span>}
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-w-[min(18rem,calc(100vw-2rem))]">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function sameTopic(a: string, b: string | undefined): boolean {
  return b !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The listed topics, plus the address's own when it names one not listed. */
function topicChoices(options: QuizListFilterOptions | undefined, current: string | undefined): string[] {
  const listed = options?.topics.map((choice) => choice.topic) ?? [];
  if (current && !listed.some((topic) => sameTopic(topic, current))) return [current, ...listed];
  return listed;
}

/** The listed years, newest first, plus the address's own when not listed. */
function yearChoices(options: QuizListFilterOptions | undefined, current: number | undefined): number[] {
  const listed = options?.years.map((choice) => choice.year) ?? [];
  if (current !== undefined && !listed.includes(current)) return [current, ...listed].sort((a, b) => b - a);
  return listed;
}
