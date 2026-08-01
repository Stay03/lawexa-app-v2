'use client';

import { cn } from '@/lib/utils';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { TabRow } from '@/v2/shell/TabRow';
import type { StatuteCountries } from '../queries';
import { toAlpha2 } from '../statute-row-model';

/**
 * CountryTabs — the jurisdiction filter over the statute library: All + one
 * tab per country that has statutes, each with its flag and its count.
 *
 * What changed from v1's `StatuteCountryTabs` (the keep/drop study):
 *  - `AnimatedTabs` (no tablist roles, no keyboard semantics) → the shared
 *    `TabRow` primitive: a real `role="tablist"` with the full APG keyboard
 *    contract (see its docblock), colour cross-fade instead of a sliding pill;
 *  - counts are SHOWN when the facets are LIVE — v1 fetched `statute_count`
 *    and never displayed it (seeded facets render label-only; see below);
 *  - the value is the country SLUG (what the URL carries), never the numeric
 *    id.
 *
 * Static chrome: the facets resolve from the seed placeholder on the first
 * frame (the caller supplies it), so the tab row never flashes in after the
 * list. On narrow screens the row scrolls horizontally, bleeding to the
 * screen edge so the scroll affordance is visible — which is why the
 * scroller wraps the tablist here instead of living on it.
 */
export function CountryTabs({
  facets,
  value,
  onChange,
}: {
  facets: StatuteCountries;
  /** The selected country SLUG, or '' for All. */
  value: string;
  onChange: (countrySlug: string) => void;
}) {
  // COUNTS ONLY WHEN THE BACKEND SAID SO. The seed's numbers are a snapshot
  // that drifts from the live library (it already disagrees with the real
  // total by one) — and unlike v1, these tabs DISPLAY counts. A number we
  // invented is worse than no number, so seeded tabs render label-only and
  // the counts appear the day `GET /statutes/countries` ships.
  const counted = facets.source === 'live';
  const tabs = [
    {
      // The empty slug is the All tab's honest id — it is exactly what
      // `onChange` writes to the URL for "no country filter".
      id: '',
      label: 'All',
      code: null as string | null,
      count: counted ? facets.total : null,
    },
    ...facets.countries.map((facet) => ({
      id: facet.country.slug,
      label: facet.country.name,
      code: toAlpha2(facet.country.code, facet.country.abbreviation),
      count: counted ? facet.statute_count : null,
    })),
  ];
  // An unknown slug in the URL selects nothing here — the browser resolves it
  // to no id, so the list genuinely shows All and the All tab says so.
  const active = tabs.some((tab) => tab.id === value) ? value : '';

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <TabRow
        tabs={tabs}
        value={active}
        onChange={onChange}
        ariaLabel="Filter statutes by country"
        className="inline-flex items-center gap-0.5 rounded-full bg-secondary/60 p-0.5"
        tabClassName={(selected) =>
          cn(
            'v2-interactive inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
            selected
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )
        }
      >
        {(tab, selected) => (
          <>
            {tab.code ? <FlagIcon code={tab.code} /> : null}
            {tab.label}
            {tab.count !== null ? (
              <span
                className={cn(
                  'tabular-nums',
                  selected
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/60',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </>
        )}
      </TabRow>
    </div>
  );
}
