import type { QueryClient } from '@tanstack/react-query';

/**
 * seed-detail — open a detail page with what the list already knew.
 *
 * ── THE PROBLEM, STATED ONCE ───────────────────────────────────────────────
 * Owner, 15 August 2026: "why have full skeletons that are empty when the list
 * page it's coming from already has some of the details needed to load the
 * details page."
 *
 * He is right, and it is app-wide. Tap a case and the list already holds its
 * title, court, date and citation — every one of them rendered on the row that
 * was just tapped. The detail page throws all of it away, reports itself as
 * `pending`, and paints an empty silhouette while it fetches a payload whose
 * first four fields it already had. The same is true of statutes, notes,
 * folders, spaces and channels.
 *
 * It happens because every feature writes its own pending branch, so every
 * feature independently decides to start from nothing. Nobody chose this; it is
 * what you get when the decision is made six times in six files.
 *
 * ── THE RULE THAT MUST NOT BE BROKEN ───────────────────────────────────────
 * SEED WITH `placeholderData`, NEVER `initialData`.
 *
 * They look interchangeable and are not. `initialData` is WRITTEN TO THE CACHE
 * and is indistinguishable from a real response afterwards — so seeding a
 * partial list row through it stores a half-record as if it were the whole
 * thing, and every later reader of that cache entry believes it. The case would
 * be cached with no judgment body, forever, and a refetch would be considered
 * unnecessary because the entry looks fresh.
 *
 * `placeholderData` is never persisted. The query reports `success` so nothing
 * renders a spinner, `isPlaceholderData` stays `true` so the screen knows which
 * half it is looking at, and the real fetch still runs underneath. That is the
 * whole difference and it is the difference between this being a speed-up and
 * being a data-corruption bug.
 *
 * ── AND THE SECOND RULE, WHICH IS EASIER TO GET WRONG ──────────────────────
 * A SEEDED FIELD THAT IS ABSENT IS NOT A FIELD THAT IS EMPTY.
 *
 * A list row carries no judgment body and no related cases. Seeded, those
 * arrive as `null`/`undefined` — and a screen that renders "No similar cases"
 * for `null` will now flash that sentence at every reader before the real
 * payload lands. Wrong, and worse than a skeleton, because a skeleton does not
 * make a claim.
 *
 * So every consumer gates on `isPlaceholderData`: the regions the list KNEW
 * render for real, and the regions it did not keep their skeleton until the
 * fetch resolves. That gate is written at each call site rather than wrapped in
 * a helper here, because WHICH regions a list knows differs per feature and a
 * shared helper would only be able to say `!isPlaceholderData` in a longer way.
 *
 * ── WHY THE OBVIOUS IMPLEMENTATION DOES NOT COMPILE, AND SHOULD NOT ────────
 * The tidy version is `placeholderData: () => ({ data: listRow })` on the
 * existing detail query. It fails, and the failure is the design telling the
 * truth: `CaseDetail` REQUIRES `creator`, `created_at` and `updated_at`, and a
 * list row has none of them. A list row is not a thin detail — it is a
 * different record.
 *
 * Casting past that would compile and would be a lie with a runtime cost: every
 * consumer of `CaseDetail` may read `created_at`, and after a cast it would
 * read `undefined` from a value the type swore was a string. That is a worse
 * bug than the empty skeleton this set out to remove.
 *
 * SO THE CORRECT SHAPE IS A PARTIAL RENDER, NOT A FAKED PAYLOAD. The screen
 * asks for the cached row, and while the real query is pending it renders the
 * header from that row — a `Case`, honestly typed — with the body region still
 * a skeleton. `findCachedRow` below is the half that is common to every
 * feature; the partial render is per screen, because only the screen knows
 * which of its regions the list row can fill.
 *
 * Recorded here rather than discovered again: the first attempt at cases was
 * reverted on 15 August for exactly this reason.
 */

/** A paginated list response, in either of the two shapes v2 caches. */
interface ListPage<TRow> {
  data?: TRow[] | null;
}
interface InfiniteList<TRow> {
  pages?: ListPage<TRow>[] | null;
}

function rowsOf<TRow>(cached: unknown): TRow[] {
  if (!cached || typeof cached !== 'object') return [];
  // Infinite lists (the browse screens) cache `{ pages: [{ data: [...] }] }`.
  const infinite = cached as InfiniteList<TRow>;
  if (Array.isArray(infinite.pages)) {
    return infinite.pages.flatMap((page) => page?.data ?? []);
  }
  // Plain lists cache `{ data: [...] }`.
  const plain = cached as ListPage<TRow>;
  return Array.isArray(plain.data) ? plain.data : [];
}

/**
 * The first cached row matching `match`, across every list query under
 * `listsKey`. `undefined` when the reader arrived cold — a shared link, a
 * refresh, a notification — which is the case that must keep its skeleton.
 *
 * It reads the cache and never writes it, so calling it during render is safe;
 * `placeholderData` is evaluated during render and this is what it calls.
 */
export function findCachedRow<TRow>(
  queryClient: QueryClient,
  listsKey: readonly unknown[],
  match: (row: TRow) => boolean,
): TRow | undefined {
  const entries = queryClient.getQueriesData<unknown>({ queryKey: listsKey });
  for (const [, cached] of entries) {
    const found = rowsOf<TRow>(cached).find(match);
    if (found) return found;
  }
  return undefined;
}
