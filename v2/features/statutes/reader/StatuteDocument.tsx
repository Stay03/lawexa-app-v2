'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';
import { statutesQueries } from '../queries';
import { parseAkn, type AknBlock, type AknOutlineDivision } from './akn';
import { AknBlockView } from './AknNode';
import {
  displayNum,
  formatProvisionLabel,
  holderBlockIndex,
  indexSections,
  parseProvisionSegment,
  resolveCitation,
} from './provision';
import {
  SectionLinkContext,
  type SectionLinkContextValue,
  type SectionLinkInfo,
} from './SectionLink';
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
  ProvisionNotice,
  isRateLimited,
} from './states';
import { Skeleton } from '@/components/ui/skeleton';
import './statute-document.css';

/**
 * StatuteDocument — fetches the AKN XML, parses it ONCE, and renders it
 * progressively. Owns everything downstream of the XML: the block sequence,
 * the outline (rail + mobile contents sheet), the scroll-spy, jumps, and the
 * arrival deep links — both `#akn-{eId}` hashes and the citation path the
 * route hands down (`/statutes/{slug}/section-54-2` → `provision`). The
 * metadata header above it is the screen's.
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

export function StatuteDocument({
  slug,
  provision,
}: {
  slug: string;
  /** The citation path segment from the URL (`section-54-2`), or null. */
  provision: string | null;
}) {
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

  /* ── Arrival deep links: `#akn-…` hash, or the citation path ──────────── */

  // The URL hash on arrival — a client-only value, read once via the lazy
  // initializer (the sanctioned pattern; SSR sees ''). Never re-read: later
  // hash changes are this page's own jumps. The snapshot also remembers WHICH
  // provision it arrived beside: a later provision change (an in-app citation
  // navigation into this same document instance) retires the hash's claim —
  // it belonged to the previous arrival, and letting it keep winning would
  // pin every subsequent citation jump to the first URL's fragment.
  const [arrivalClaim] = useState(() => ({
    hash: typeof window === 'undefined' ? '' : window.location.hash.slice(1),
    provision,
  }));
  const initialHash =
    arrivalClaim.provision === provision ? arrivalClaim.hash : '';

  // The citation path, resolved against the parsed document: `section-54-2`
  // → the subsection's `akn-{eId}` anchor inside section 54's block. The
  // index is also what the copy affordance mints from (context below), so a
  // link can only be minted where this resolution would land it.
  const citation = useMemo(
    () => (provision ? parseProvisionSegment(provision) : null),
    [provision],
  );
  const sectionIndex = useMemo(() => indexSections(blocks), [blocks]);
  const provisionTarget = useMemo(
    () => (citation ? resolveCitation(sectionIndex, citation) : null),
    [sectionIndex, citation],
  );

  // ONE arrival target, with the precedence rule: an explicit hash BEATS the
  // citation path (the hash is the more specific claim — it names an exact
  // element). A hash that points inside a block (a subsection anchor) mounts
  // through its holder; a hash that resolves to nothing falls through to the
  // citation path rather than dead-ending the arrival.
  const arrival = useMemo<{ index: number; anchorId: string } | null>(() => {
    if (blocks.length === 0) return null;
    if (initialHash) {
      const direct = blockIndexById.get(initialHash);
      if (direct !== undefined) return { index: direct, anchorId: initialHash };
      const holder = holderBlockIndex(blocks, initialHash);
      if (holder !== null) return { index: holder, anchorId: initialHash };
    }
    if (provisionTarget && provisionTarget.matched !== 'none') {
      const index = blockIndexById.get(provisionTarget.blockId);
      if (index !== undefined) {
        return { index, anchorId: provisionTarget.anchorId };
      }
    }
    return null;
  }, [blocks, blockIndexById, initialHash, provisionTarget]);

  // WHICH provision value the arrival jump already ran for — `undefined`
  // before any arrival, so a provision CHANGE re-arms by construction (the
  // stored value no longer matches) while a post-jump re-run of this effect
  // (an XML refetch swapping `blocks` identity, provision unchanged) still
  // bails and can never yank the reader back to the target mid-read.
  const arrivalHandledFor = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (arrivalHandledFor.current === provision || !arrival) return;
    // Only the FIRST arrival is a page entry with competing claims; a
    // provision-change jump is the reader's own navigation and scrolls
    // unconditionally, exactly like an outline jump.
    const firstArrival = arrivalHandledFor.current === undefined;
    // The latch is set ONLY when the jump actually runs, and a cleanup that
    // arrives first clears the still-pending timer — so StrictMode's
    // mount→cleanup→remount (and any real remount) re-schedules instead of
    // permanently disarming the deep link.
    let ran = false;
    const timer = window.setTimeout(() => {
      ran = true;
      arrivalHandledFor.current = provision;
      setMountedCount((prev) => Math.max(prev, arrival.index + 1));
      requestAnimationFrame(() => {
        // Yield to anyone with a better claim: if the reader (or
        // ScrollMemory's reload restore) has already moved the scroller,
        // the page-entry deep link does not fight them.
        if (firstArrival) {
          const scroller = document.getElementById(V2_SHELL_CONTENT_ID);
          if (scroller && scroller.scrollTop > 0) return;
        }
        document
          .getElementById(arrival.anchorId)
          ?.scrollIntoView({ block: 'start' });
        requestAnimationFrame(() => {
          document
            .getElementById(arrival.anchorId)
            ?.scrollIntoView({ block: 'start' });
        });
      });
    }, 0);
    return () => {
      if (!ran) window.clearTimeout(timer);
    };
  }, [arrival, provision]);

  // The honest word when the citation path did not (fully) land. Suppressed
  // when an explicit hash won the arrival — the reader stands where the link's
  // minter pointed, and a "not found" would contradict the landing.
  const provisionNotice = useMemo<string | null>(() => {
    if (!provision || blocks.length === 0) return null;
    if (initialHash && arrival?.anchorId === initialHash) return null;
    if (!citation) {
      return 'This link does not point to a provision of this statute.';
    }
    if (!provisionTarget || provisionTarget.matched === 'none') {
      return `${formatProvisionLabel(citation)} was not found in this statute.`;
    }
    if (provisionTarget.matched === 'section' && citation.subsection) {
      return `${formatProvisionLabel(citation)} was not found. Showing section ${displayNum(citation.section)}.`;
    }
    return null;
  }, [provision, blocks.length, initialHash, arrival, citation, provisionTarget]);
  // Dismissal is scoped to the provision it dismissed — a NEW citation
  // navigation gets its own notice without any reset effect.
  const [noticeDismissedFor, setNoticeDismissedFor] = useState<string | null>(
    null,
  );
  const noticeDismissed =
    provision !== null && noticeDismissedFor === provision;

  // The ONE polite live region the copy affordances speak through (a region
  // per section heading would be hundreds of empty live regions). The clear
  // timer re-arms per announcement — and emptying the region after the beat
  // is what lets the NEXT identical "Link copied" read as a fresh change.
  const [copyAnnouncement, setCopyAnnouncement] = useState('');
  const announceTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (announceTimerRef.current !== null) {
        window.clearTimeout(announceTimerRef.current);
      }
    },
    [],
  );

  // What the copy affordance needs (SectionLink) — the slug, the citable map
  // derived from the SAME index the resolver reads (so a minted link and its
  // landing can never disagree), and the shared announcer.
  const sectionLinks = useMemo<SectionLinkContextValue>(() => {
    const links = new Map<string, SectionLinkInfo>();
    for (const target of sectionIndex.values()) {
      links.set(target.anchorId, { path: target.path, label: target.label });
    }
    return {
      slug,
      links,
      announce: (message: string) => {
        setCopyAnnouncement(message);
        if (announceTimerRef.current !== null) {
          window.clearTimeout(announceTimerRef.current);
        }
        announceTimerRef.current = window.setTimeout(() => {
          announceTimerRef.current = null;
          setCopyAnnouncement('');
        }, 2000);
      },
    };
  }, [slug, sectionIndex]);

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
      {provisionNotice && !noticeDismissed ? (
        <ProvisionNotice
          message={provisionNotice}
          onDismiss={() => setNoticeDismissedFor(provision)}
        />
      ) : null}

      <span aria-live="polite" className="sr-only">
        {copyAnnouncement}
      </span>

      <SectionLinkContext.Provider value={sectionLinks}>
        <div className="akn-doc motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {blocks.slice(0, visibleCount).map((block) => (
            <AknBlockView key={block.key} block={block} />
          ))}
          {mounting ? <DocumentMountingTail /> : null}
        </div>
      </SectionLinkContext.Provider>

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
