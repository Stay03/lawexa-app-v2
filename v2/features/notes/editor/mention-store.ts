'use client';

import type { QueryClient } from '@tanstack/react-query';

import { casesQueries } from '@/v2/features/cases/queries';
import { firstCitation, formatCaseName } from '@/v2/features/cases/case-name';

/**
 * mention-store — the state behind the `@` case picker, as a plain external
 * store the popup reads through `useSyncExternalStore`.
 *
 * ── WHY A STORE AND NOT A `ReactRenderer` ───────────────────────────────────
 * `@tiptap/suggestion` is a ProseMirror plugin: its `render()` hooks are
 * imperative callbacks that live outside React entirely, and v1 bridged them by
 * mounting a detached React root inside a tippy.js popup. That bought a second
 * React tree with no access to theme, portals, or the app's own providers, plus
 * a dependency whose only job was positioning.
 *
 * Here the plugin writes into this store and the popup — an ordinary component
 * in the editor's own tree — reads it. One React tree, no tippy, and the list's
 * behaviour (which row is active, what a key press does) is testable logic in a
 * plain module rather than something only reachable by typing into an editor.
 *
 * ── THE SEARCH IS OURS, NOT THE PLUGIN'S ────────────────────────────────────
 * The plugin's own `items()` is left returning nothing. v1 wired the API call
 * straight into it and fired a case search on EVERY keystroke — the defect the
 * rebuild exists to remove — and this version of `@tiptap/suggestion` (3.15.3)
 * has neither a `debounce` nor a `minQueryLength` option to lean on. So the
 * plugin only reports "the query is now X" and this store decides when that is
 * worth a request: at least two characters, at least 250ms of quiet, one
 * generation counter so a slow answer can never overwrite a newer one, and the
 * shared query cache underneath so a repeated search costs nothing.
 */

/** How long the query must stand still before a search goes out. */
const SEARCH_DEBOUNCE_MS = 250;

/** Below this, `@a` would match half the corpus — not worth a request. */
const MIN_QUERY_LENGTH = 2;

/**
 * Above this, the `@` was not a mention.
 *
 * `allowSpaces` has to be on — case names have spaces ("Okafor v. Nweke") — but
 * it also means a stray `@` in ordinary prose keeps swallowing the rest of the
 * sentence into the query, and every typing pause after it spends a case
 * search. No case name is 64 characters; past that the reader is plainly
 * writing prose, so the picker stops asking. It stays open and silent rather
 * than closing, because a close would be a visible event the reader did not
 * cause.
 */
const MAX_QUERY_LENGTH = 64;

/** Rows in the picker. Enough to choose from, short enough to scan. */
const MAX_ITEMS = 8;

/** What gets inserted, and what the row shows. */
export interface CaseMentionItem {
  id: number;
  slug: string;
  /** The readable case name — what the mention's text becomes. */
  label: string;
  /** Court · year · citation, for the row's quiet second line. */
  meta: string | null;
}

/** Where the `@` sits, in viewport coordinates, plus the room around it. */
export interface MentionAnchor {
  top: number;
  bottom: number;
  left: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface CaseMentionSnapshot {
  readonly open: boolean;
  readonly query: string;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly items: readonly CaseMentionItem[];
  readonly activeIndex: number;
  readonly anchor: MentionAnchor | null;
}

const CLOSED: CaseMentionSnapshot = {
  open: false,
  query: '',
  loading: false,
  failed: false,
  items: [],
  activeIndex: 0,
  anchor: null,
};

/** What the plugin hands over when the picker opens or the query moves. */
export interface MentionSession {
  clientRect: (() => DOMRect | null) | null | undefined;
  query: string;
  command: (item: CaseMentionItem) => void;
}

export interface CaseMentionStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => CaseMentionSnapshot;
  getServerSnapshot: () => CaseMentionSnapshot;
  /** The picker opened at the `@`. */
  start: (session: MentionSession) => void;
  /** The query or the caret moved. */
  update: (session: MentionSession) => void;
  /** The picker closed (escape, a space, a click away, the insert). */
  exit: () => void;
  /** Move the highlight, wrapping at both ends. */
  moveActive: (delta: number) => void;
  /** Point at a row (hover / pointer down). */
  setActive: (index: number) => void;
  /** Insert the row at `index`, or the active one. */
  choose: (index?: number) => void;
  /** The plugin's key handler. `true` means "handled, do not type this". */
  handleKeyDown: (event: KeyboardEvent) => boolean;
  /** Release timers and listeners (editor teardown). */
  destroy: () => void;
}

function sameItems(
  a: readonly CaseMentionItem[],
  b: readonly CaseMentionItem[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => item.id === b[index].id);
}

function sameAnchor(a: MentionAnchor | null, b: MentionAnchor | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    a.viewportWidth === b.viewportWidth &&
    a.viewportHeight === b.viewportHeight
  );
}

function sameSnapshot(a: CaseMentionSnapshot, b: CaseMentionSnapshot): boolean {
  return (
    a.open === b.open &&
    a.query === b.query &&
    a.loading === b.loading &&
    a.failed === b.failed &&
    a.activeIndex === b.activeIndex &&
    sameItems(a.items, b.items) &&
    sameAnchor(a.anchor, b.anchor)
  );
}

/** Project one API case onto a picker row. */
function toItem(source: {
  id: number;
  slug: string;
  display_title: string;
  title: string;
  court: { name: string } | null;
  judgment_date: string | null;
  citation: string | null;
}): CaseMentionItem {
  const year = source.judgment_date?.slice(0, 4) ?? null;
  const meta =
    [source.court?.name ?? null, year, firstCitation(source.citation)]
      .filter((part): part is string => Boolean(part))
      .join(' · ') || null;
  return {
    id: source.id,
    slug: source.slug,
    label: formatCaseName(source.display_title || source.title),
    meta,
  };
}

export function createCaseMentionStore(config: {
  queryClient: QueryClient;
  viewerId: number | null;
}): CaseMentionStore {
  const { queryClient, viewerId } = config;

  let snapshot: CaseMentionSnapshot = CLOSED;
  const listeners = new Set<() => void>();

  let command: ((item: CaseMentionItem) => void) | null = null;
  let clientRect: (() => DOMRect | null) | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every query change; a resolved search writes only if it is still current. */
  let generation = 0;
  /**
   * Escape was pressed for the CURRENT suggestion session. Per session, not
   * global: cleared by `start()` (a new `@`) and honoured by `apply()`, so a
   * dismissal lasts exactly as long as the `@…` the reader dismissed.
   */
  let dismissed = false;

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function set(next: CaseMentionSnapshot): void {
    if (sameSnapshot(snapshot, next)) return;
    snapshot = next;
    emit();
  }

  /** Re-measure the `@` against the viewport (the caret moves when the page scrolls). */
  function syncAnchor(): void {
    if (!clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    set({
      ...snapshot,
      anchor: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    });
  }

  /**
   * The editor lives inside the shell's scroll container, so the caret moves
   * under a scroll that never reaches `window`. `capture: true` is what lets one
   * listener see scrolls from any nested scroller.
   */
  function watchViewport(on: boolean): void {
    if (typeof window === 'undefined') return;
    if (on) {
      window.addEventListener('scroll', syncAnchor, true);
      window.addEventListener('resize', syncAnchor);
    } else {
      window.removeEventListener('scroll', syncAnchor, true);
      window.removeEventListener('resize', syncAnchor);
    }
  }

  function clearSearchTimer(): void {
    if (searchTimer !== null) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
  }

  async function runSearch(query: string, forGeneration: number): Promise<void> {
    try {
      const response = await queryClient.fetchQuery(
        casesQueries.list({ search: query, per_page: MAX_ITEMS, viewerId }),
      );
      if (forGeneration !== generation) return; // a newer query has taken over
      set({
        ...snapshot,
        loading: false,
        failed: false,
        items: response.data.slice(0, MAX_ITEMS).map(toItem),
        activeIndex: 0,
      });
    } catch {
      if (forGeneration !== generation) return;
      set({ ...snapshot, loading: false, failed: true, items: [], activeIndex: 0 });
    }
  }

  function scheduleSearch(query: string): void {
    clearSearchTimer();
    generation += 1;
    const forGeneration = generation;

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH || trimmed.length > MAX_QUERY_LENGTH) {
      set({ ...snapshot, loading: false, failed: false, items: [], activeIndex: 0 });
      return;
    }

    set({ ...snapshot, loading: true, failed: false });
    searchTimer = setTimeout(() => {
      searchTimer = null;
      void runSearch(trimmed, forGeneration);
    }, SEARCH_DEBOUNCE_MS);
  }

  function apply(session: MentionSession, opening: boolean): void {
    command = session.command;
    clientRect = session.clientRect ?? null;

    // Escape dismissed THIS suggestion session. The plugin session itself is
    // still live — the `@…` text is still in the document, so the very next
    // keystroke calls `onUpdate` — and without this flag the picker would pop
    // straight back up, which makes Escape look broken. The flag is cleared
    // only by `start()`, i.e. by a genuinely new `@`.
    if (dismissed) return;

    const queryChanged = opening || session.query !== snapshot.query;
    set({
      ...snapshot,
      open: true,
      query: session.query,
      ...(opening ? { items: [], activeIndex: 0, failed: false } : {}),
    });
    // Attached HERE, not only in `start()`: a session that was dismissed and
    // then resumed, or one whose `onStart` we returned from early, would
    // otherwise render a panel that never follows the caret again. Idempotent —
    // `addEventListener` with the same function and options is a no-op.
    watchViewport(true);
    syncAnchor();
    if (queryChanged) scheduleSearch(session.query);
  }

  function exit(): void {
    clearSearchTimer();
    generation += 1; // orphan any in-flight search
    watchViewport(false);
    command = null;
    clientRect = null;
    set(CLOSED);
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => CLOSED,

    start: (session) => {
      // A new `@` is a new session, so any earlier dismissal is spent.
      dismissed = false;
      apply(session, true);
    },
    update: (session) => apply(session, false),
    // The plugin's own teardown (a click away, a space that ends the match, the
    // insert). Not a dismissal — there is no session left to dismiss.
    exit,

    moveActive: (delta) => {
      const count = snapshot.items.length;
      if (count === 0) return;
      const next = (snapshot.activeIndex + delta + count) % count;
      set({ ...snapshot, activeIndex: next });
    },

    setActive: (index) => {
      if (index < 0 || index >= snapshot.items.length) return;
      set({ ...snapshot, activeIndex: index });
    },

    choose: (index) => {
      const item = snapshot.items[index ?? snapshot.activeIndex];
      if (!item || !command) return;
      // The plugin's own command replaces the `@query` range with the node and
      // then tears the session down, which calls `exit()` for us.
      command(item);
    },

    /**
     * The picker owns these keys only while it has something to offer — with an
     * empty list, Enter must still break the line and the arrows must still move
     * the caret. Escape always closes, because that is what Escape means.
     */
    handleKeyDown: (event) => {
      if (!snapshot.open) return false;
      if (event.key === 'Escape') {
        // Mark the session dismissed BEFORE closing, so the next keystroke's
        // `onUpdate` finds the flag and leaves the picker shut.
        dismissed = true;
        exit();
        return true;
      }
      if (snapshot.items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        const count = snapshot.items.length;
        set({ ...snapshot, activeIndex: (snapshot.activeIndex + 1) % count });
        return true;
      }
      if (event.key === 'ArrowUp') {
        const count = snapshot.items.length;
        set({ ...snapshot, activeIndex: (snapshot.activeIndex - 1 + count) % count });
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = snapshot.items[snapshot.activeIndex];
        if (!item || !command) return false;
        command(item);
        return true;
      }
      return false;
    },

    destroy: () => {
      exit();
      listeners.clear();
    },
  };
}
