'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';
import { statutesQueries } from '../queries';
import { parseAkn, type AknBlock, type AknOutlineDivision } from './akn';
import { AknBlockView } from './AknNode';
import {
  StatuteContentsSheet,
  StatuteOutlineRail,
  useStatuteScrollSpy,
} from './StatuteOutline';
import {
  DocumentEmptyState,
  DocumentErrorState,
  DocumentMountingTail,
  DocumentUnreadableState,
  isRateLimited,
} from './states';
import { Skeleton } from '@/components/ui/skeleton';
import './statute-document.css';

/**
 * StatuteDocument — fetches the AKN XML, parses it ONCE, and renders it
 * progressively. Owns everything downstream of the XML: the block sequence,
 * the outline (rail + mobile contents sheet), the scroll-spy, jumps, and
 * `#anchor` deep links. The metadata header above it is the screen's.
 *
 * ── WHY THE XML IS A CLIENT FETCH, NOT AN RSC PREFETCH ─────────────────────
 * Dehydrating this query would serialize the ENTIRE XML string (275 KB
 * measured; 880 KB for the Nigerian constitution) into the page's flight
 * payload — the document's first paint would wait on the heaviest asset the
 * route owns, which is exactly backwards. The header (a small metadata read)
 * paints first; the XML streams behind the document skeleton. The parse is
 * also DOMParser-bound — a browser-only API (workers have no DOM either), so
 * the server could never do more than ship the string.
 *
 * ── THE BIG-DOCUMENT STRATEGY (two levers, researched July 31) ─────────────
 * A 719-node Act rendered as one synchronous React tree is a multi-hundred-
 * millisecond main-thread block, and the constitution is 4× that. Two levers,
 * multiplicative:
 *
 *  1. PROGRESSIVE MOUNTING — the parse flattens the document into ~N section-
 *     grade blocks (`akn.ts`); the first {@link INITIAL_BLOCKS} mount
 *     immediately (several screens' worth), then batches of
 *     {@link MOUNT_BATCH} mount on a yielding timer, so no commit is ever
 *     large and the browser paints between batches. A pulsing tail marks the
 *     in-flight remainder; jumps and deep links force-mount THROUGH their
 *     target, so wayfinding never waits on the tail.
 *  2. `content-visibility: auto` (+ `contain-intrinsic-size`) on every body
 *     block — offscreen blocks skip layout and paint entirely, so both each
 *     mount batch and steady-state scrolling cost only the screenful in view.
 *     Find-in-page still searches skipped content (spec behaviour), and spy /
 *     jump targets are the block WRAPPERS, which keep real geometry while
 *     skipped.
 *
 * The parse itself (~100–200 ms on the biggest Acts) is memoized on the XML
 * string and runs exactly once per document per session — the akn query's
 * `static` staleTime exists so a background refetch can never re-run it under
 * the reader.
 */

/** First slice: enough blocks to fill a couple of screens on any viewport. */
const INITIAL_BLOCKS = 16;
/** Blocks appended per yield — small enough that a batch commit stays well
 *  under a frame budget once content-visibility skips offscreen layout. */
const MOUNT_BATCH = 40;
/** The yield between batches — a macrotask, so the browser paints. */
const MOUNT_YIELD_MS = 16;

const NO_BLOCKS: AknBlock[] = [];
const NO_OUTLINE: AknOutlineDivision[] = [];

export function StatuteDocument({ slug }: { slug: string }) {
  const query = useQuery(statutesQueries.akn(slug));

  // ONE parse per document string (see docblock). `parseAkn` returns null for
  // unparseable XML — rendered as the designed "can't be displayed" state.
  const model = useMemo(
    () => (query.data ? parseAkn(query.data) : null),
    [query.data],
  );
  const blocks = model?.blocks ?? NO_BLOCKS;
  const outline = model?.outline ?? NO_OUTLINE;

  /* ── Progressive mounting ─────────────────────────────────────────────── */

  const [mountedCount, setMountedCount] = useState(INITIAL_BLOCKS);
  const visibleCount = Math.min(mountedCount, blocks.length);
  const mounting = blocks.length > 0 && visibleCount < blocks.length;

  // The batch loop: each pass schedules ONE macrotask that widens the window,
  // then re-runs. `setState` lives in the timer callback, never the effect
  // body — the async escape the React Compiler lint permits — and the yield
  // between commits is what keeps the main thread responsive.
  useEffect(() => {
    if (blocks.length === 0 || mountedCount >= blocks.length) return;
    const timer = window.setTimeout(() => {
      setMountedCount((prev) => Math.min(prev + MOUNT_BATCH, blocks.length));
    }, MOUNT_YIELD_MS);
    return () => window.clearTimeout(timer);
  }, [mountedCount, blocks.length]);

  const blockIndexById = useMemo(() => {
    const map = new Map<string, number>();
    blocks.forEach((block, index) => {
      if (block.id) map.set(block.id, index);
    });
    return map;
  }, [blocks]);

  /* ── Wayfinding: spy, jumps, deep links ───────────────────────────────── */

  const spyIds = useMemo(() => {
    const ids: string[] = [];
    for (const division of outline) {
      ids.push(division.id);
      for (const section of division.sections) ids.push(section.id);
    }
    return ids;
  }, [outline]);
  const activeId = useStatuteScrollSpy(spyIds, visibleCount);

  /**
   * Jump to an anchor. Mounts THROUGH the target first (never the whole
   * document — the batch loop keeps filling the tail behind the reader),
   * then scrolls INSTANTLY: a contents jump in a statute travels dozens of
   * screens, and animating that is disorientation, not polish — which also
   * satisfies reduced-motion by construction. The second same-frame-after
   * pass re-lands the scroll once `content-visibility` estimates around the
   * target settle into real heights.
   */
  const jump = (id: string) => {
    const index = blockIndexById.get(id);
    if (index !== undefined) {
      setMountedCount((prev) => Math.max(prev, index + 1));
    }
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
      });
    });
  };

  // The URL hash on arrival — a client-only value, read once via the lazy
  // initializer (the sanctioned pattern; SSR sees ''). Never re-read: later
  // hash changes are this page's own jumps.
  const [initialHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash.slice(1),
  );
  const hashHandled = useRef(false);
  useEffect(() => {
    if (hashHandled.current || blocks.length === 0 || !initialHash) return;
    const index = blockIndexById.get(initialHash);
    if (index === undefined) return;
    // The latch is set ONLY when the jump actually runs, and a cleanup that
    // arrives first clears the still-pending timer — so StrictMode's
    // mount→cleanup→remount (and any real remount) re-schedules instead of
    // permanently disarming the deep link, while a post-jump re-run of this
    // effect (an XML refetch swapping `blocks` identity) still bails on the
    // latch and can never yank the reader back to the hash target mid-read.
    let ran = false;
    const timer = window.setTimeout(() => {
      ran = true;
      hashHandled.current = true;
      setMountedCount((prev) => Math.max(prev, index + 1));
      requestAnimationFrame(() => {
        // Yield to anyone with a better claim: if the reader (or
        // ScrollMemory's reload restore) has already moved the scroller,
        // this deep link does not fight them.
        const scroller = document.getElementById(V2_SHELL_CONTENT_ID);
        if (scroller && scroller.scrollTop > 0) return;
        document.getElementById(initialHash)?.scrollIntoView({ block: 'start' });
        requestAnimationFrame(() => {
          document
            .getElementById(initialHash)
            ?.scrollIntoView({ block: 'start' });
        });
      });
    }, 0);
    return () => {
      if (!ran) window.clearTimeout(timer);
    };
  }, [blocks, blockIndexById, initialHash]);

  /* ── States ───────────────────────────────────────────────────────────── */

  if (query.isPending) {
    return <DocumentBodySkeleton />;
  }

  if (query.isError) {
    return (
      <DocumentErrorState
        rateLimited={isRateLimited(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!model) {
    return <DocumentUnreadableState />;
  }

  if (blocks.length === 0) {
    return <DocumentEmptyState />;
  }

  const showContents = spyIds.length >= 4;

  return (
    <>
      <div className="akn-doc motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {blocks.slice(0, visibleCount).map((block) => (
          <AknBlockView key={block.key} block={block} />
        ))}
        {mounting ? <DocumentMountingTail /> : null}
      </div>

      {showContents ? (
        <StatuteContentsSheet outline={outline} activeId={activeId} onJump={jump} />
      ) : null}

      {/* The contents rail, in the dead margin beside the column — shown only
          where that margin TRULY exists. The breakpoints are computed against
          the whole shell, not the bare viewport (filmed defect: a viewport
          threshold ignored the sidebar and the rail exited the screen):

            sidebar 256px + column 768px (48rem, incl. its px-4)
            + 2 × (gutter 40px + rail 192px)      = 1488px
            + ~15px classic-scrollbar allowance   → first honest step 96rem
              (1536px: margin/side = (1536−256−768−15)/2 ≈ 248px ≥ 232px)

            wider rail 240px: 256 + 768 + 2 × 280 = 1584px + allowance
              → 102rem (1632px: ≈ 296px ≥ 280px)

          Below 96rem the mobile Contents pill + sheet take over (their
          breakpoint mirrors this one). */}
      {showContents ? (
        <aside className="absolute inset-y-0 left-full ml-10 hidden w-48 min-[102rem]:w-60 min-[96rem]:block">
          <div className="sticky top-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <StatuteOutlineRail outline={outline} activeId={activeId} onJump={jump} />
          </div>
        </aside>
      ) : null}
    </>
  );
}

/** The document region's own skeleton — the shape under the (already live)
 *  header while the XML streams: a part heading and pulsing provisions. */
function DocumentBodySkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading statute text
      </span>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-5 w-1/2 rounded" />
        <div className="space-y-4 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="mt-1 h-3 w-7 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton
                  className="h-4 rounded"
                  style={{ width: `${[94, 100, 82, 66][i]}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
