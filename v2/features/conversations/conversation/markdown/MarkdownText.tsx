'use client';

import {
  memo,
  startTransition,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import Markdown, { type Components, type Options } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { CaseMentionLink } from './CaseMentionLink';
import { FencedBlock } from './FencedBlock';
import { eagerStart, scheduleSwap, type FrameTimers } from './defer-plan';
import { PREPARED_CHARS_CAP, createPreparedBlocks } from './prepared-blocks';
import { linkReferenceLines } from './reference-lines';
import { rehypeStreamWords } from './rehype-stream-words';
import { ScrollKeepContext } from './scroll-keep-context';
import { scrollCorrection, type PendingRegion } from './scroll-keep';
import { splitMarkdownBlocks } from './split-blocks';

/**
 * MarkdownText — the streaming-safe markdown renderer (foundation-standards §5).
 *
 * Streamdown (the standards' first pick) is NOT installed, so this implements the
 * sanctioned alternative: a block pipeline with per-block `React.memo`. The text is
 * split into markdown blocks on blank lines (fenced code kept intact); each block
 * renders through its own memoized `<MarkdownBlock>`. During a stream only the LAST
 * block's string changes on each ~60ms flush, so only that block re-parses/re-renders
 * — every earlier block bails out of render. Combined with the per-row streaming
 * subscription and the list's row memoization, a token never re-parses the whole
 * message (v1's defect) nor touches any other row.
 *
 * Each block's parse renders its elements as direct children (react-markdown v10
 * renders a fragment, no wrapper), so all blocks are direct children of the one
 * prose container and prose vertical rhythm is preserved across block boundaries.
 *
 * WORD FADE (`animate`). Live streaming text is released in whole WORDS by the
 * smoother, which cuts the publish rate from ~60/s to ~23/s; the sub-word smoothness
 * that buys back is supplied by a compositor-only opacity fade on each newly-mounted
 * word, injected by the {@link rehypeStreamWords} rehype plugin. `animate` reaches
 * `MarkdownBlock` as a PROP, so the per-block memo still holds within a mode and
 * still invalidates when the mode flips — which is what guarantees a finished
 * message ends up with zero span overhead.
 *
 * DEFERRED BLOCKS ON AN OPEN (defer-plan.ts). A long landed answer drawn by an
 * open that lands at the bottom parses only its last blocks in the opening
 * frame; the blocks above draw as muted raw text (`.v2-md-pending`, shell.css)
 * and all swap to parsed markdown in one transition two frames later, or at
 * the 1 s deadline at the latest. Where the browser has no scroll anchoring
 * the swap's layout effect keeps the reader's place (scroll-keep.ts). Streaming
 * text never defers.
 *
 * PREPARED BLOCKS (prepared-blocks.ts). A landed block's parsed elements are
 * kept in a module-level cache keyed by the block's text, so the second open
 * of a chat draws its answers without parsing them, and so does the fill of
 * the older messages behind the first frame. An answer whose blocks are all
 * kept defers none of them: there is nothing left to spread over frames.
 */

/**
 * THE FADE IS THE TAIL'S (speed step 6, part 2; Stay, 17 October 2026). Only
 * the last two blocks of a streaming answer take the animated pipeline. A
 * block further back is finished: it parses once, plain, into preparedBlocks,
 * and holds no word spans while the answer goes on. Two and not one, so the
 * block that has just been left still plays its words' 160ms fade out when
 * the next one starts. When the answer lands, only those two re-parse; every
 * block before them is already the plain parse, so its memo holds.
 */
const ANIMATED_TAIL_BLOCKS = 2;

// Stable module-level plugin list — a fresh array each render would defeat memo.
const REMARK_PLUGINS = [remarkBreaks, remarkGfm];

/**
 * The two rehype pipelines, both module-level constants: `animate` selects
 * between them per block, and only the plain one's output is ever kept
 * (preparedBlocks), so a finished message renders exactly once more, with zero
 * word spans left in its DOM ({@link rehypeStreamWords}).
 */
const REHYPE_ANIMATED: Options['rehypePlugins'] = [rehypeStreamWords];
const REHYPE_PLAIN: Options['rehypePlugins'] = [];

/**
 * Stable module-level component overrides, defined once so every kept block's
 * elements reference the same components. It overrides only `a`, routing
 * case-mention links through the preview (hover-card on pointer devices, tap
 * popover on touch); every other anchor renders exactly as react-markdown's
 * default. {@link CaseMentionLink} holds no data hook, so a token flush never
 * fetches or re-renders beyond the block already re-parsing.
 *
 * `pre` routes fenced blocks through {@link FencedBlock}: a fence the AI used
 * for a document (a court form, a letter) renders as a document block, real
 * code keeps the code look (fence-kind.ts).
 */
const MARKDOWN_COMPONENTS: Components = { a: CaseMentionLink, pre: FencedBlock };

/**
 * The parsed blocks of landed answers, kept across opens (prepared-blocks.ts).
 * Only the plain pipeline's output goes in: the animated one's carries word
 * spans and changes with every flush.
 */
const preparedBlocks = createPreparedBlocks<ReactElement>(PREPARED_CHARS_CAP);

/**
 * One block's markdown as React elements. react-markdown's synchronous
 * renderer is a plain function of its props, with no hook and no context, so
 * it is called as one here: its result for a block can then be kept
 * (preparedBlocks) and drawn again on a later open. Rendered as an element in
 * the tree, as it was, its parse ran inside its own render on every mount, and
 * nothing outside could keep the result.
 */
function parseBlock(content: string, rehypePlugins: Options['rehypePlugins']): ReactElement {
  return Markdown({
    children: content,
    remarkPlugins: REMARK_PLUGINS,
    rehypePlugins,
    components: MARKDOWN_COMPONENTS,
  });
}

const PROSE_CLASS =
  'prose prose-sm dark:prose-invert max-w-none overflow-x-hidden break-words ' +
  '[&_a]:text-primary [&_a.case-mention]:no-underline ' +
  // `[&_pre]:text-foreground`: the typography plugin gives `pre` light text for
  // its own dark box; with the muted background below, code was near-invisible
  // in light mode (seen 7 October 2026).
  // `[&_pre]:rounded-2xl!`: the app's Card corner, the same as a document block
  // (FencedBlock), instead of the 0.5em in globals.css, which v1 keeps. That
  // `.prose pre` rule sits outside every CSS layer, so it beats any utility
  // without the `!`.
  '[&_code]:bg-muted [&_pre]:bg-muted [&_pre]:text-foreground [&_pre]:rounded-2xl! [&_pre]:overflow-x-auto [&_pre]:overscroll-x-contain';

/** The browser's frames and timers for {@link scheduleSwap}; only called from effects. */
const BROWSER_FRAMES: FrameTimers = {
  requestAnimationFrame: (run) => window.requestAnimationFrame(run),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
  setTimeout: (run, ms) => window.setTimeout(run, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

/**
 * The height of the deferred region: from the prose container's top to the
 * first element the eager blocks drew (the container's bottom if they drew
 * none). The eager blocks' elements are the last `eagerElements` children,
 * before and after the swap alike, so the same count finds the edge on both
 * sides.
 */
function regionHeight(container: HTMLElement, eagerElements: number): number {
  const top = container.getBoundingClientRect().top;
  const edge = eagerElements > 0 ? container.children[container.children.length - eagerElements] : null;
  return (edge ? edge.getBoundingClientRect().top : container.getBoundingClientRect().bottom) - top;
}

/**
 * A deferred block before the swap: its raw markdown, muted so the marks are
 * not read as the answer, in the prose paragraph's font and margins so its
 * height is close to the parsed block's. One element, always: the swap counts
 * on it (regionHeight).
 */
const PendingBlock = memo(function PendingBlock({ content }: { content: string }) {
  return <p className="v2-md-pending">{content}</p>;
});

const MarkdownBlock = memo(function MarkdownBlock({
  content,
  animate,
}: {
  content: string;
  animate: boolean;
}) {
  // Streaming text: parsed on every flush, through the animated pipeline, never kept.
  if (animate) return parseBlock(content, REHYPE_ANIMATED);
  const kept = preparedBlocks.get(content);
  if (kept) return kept;
  const parsed = parseBlock(content, REHYPE_PLAIN);
  // Kept during render: the parse is a pure function of the text, so a render
  // React throws away leaves an entry that is right for its text, and a second
  // render of the same block (StrictMode) reads it instead of parsing twice.
  preparedBlocks.set(content, parsed);
  return parsed;
});

export const MarkdownText = memo(function MarkdownText({
  content,
  className,
  animate = false,
}: {
  content: string;
  className?: string;
  /** While true, newly-revealed words fade in (see {@link rehypeStreamWords}). Set
   *  only for LIVE streaming text; a finished message renders with no span
   *  overhead at all. */
  animate?: boolean;
}) {
  // The reference list's raw addresses become linked case names first
  // (reference-lines.ts), so they cannot run off a phone screen.
  const blocks = useMemo(() => splitMarkdownBlocks(linkReferenceLines(content)), [content]);

  // The deferral plan, read once at mount (defer-plan.ts). No MessageList
  // above (no context): nothing defers. A row mounted streaming, or empty as a
  // streaming row starts, defers nothing and never will. Nor does an answer
  // whose blocks are all kept (preparedBlocks): they draw parsed at the cost
  // of a lookup, and a deferral would only add the swap.
  const keep = useContext(ScrollKeepContext);
  const [plan] = useState(() => ({
    content,
    eagerFrom:
      keep && !blocks.every((block) => preparedBlocks.has(block))
        ? eagerStart(blocks, { streaming: animate || content === '', landsAtBottom: keep.landsAtBottom })
        : 0,
  }));
  const [swapped, setSwapped] = useState(false);
  // How many leading blocks draw as placeholders in this render. A changed
  // text or a turn to streaming drops the plan: every block parses.
  const pendingCount =
    swapped || animate || plan.content !== content ? 0 : Math.min(plan.eagerFrom, blocks.length);

  const containerRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<{ region: PendingRegion; eagerElements: number } | null>(null);
  const scrollerRef = keep?.scrollerRef;
  const atBottomRef = keep?.atBottomRef;
  const keepPlace = keep?.keepPlace;
  const anchoring = keep?.anchoring ?? true;

  // The swap: a transition two frames after mount, an urgent render at the
  // deadline (scheduleSwap). Where the browser has no scroll anchoring, the
  // region is measured first, while it still holds the placeholders. The swap
  // committing sets pendingCount to 0, whose cleanup drops the deadline.
  useEffect(() => {
    if (pendingCount === 0) return;
    return scheduleSwap(BROWSER_FRAMES, (urgent) => {
      const scroller = scrollerRef?.current;
      const container = containerRef.current;
      if (!anchoring && scroller && container) {
        const eagerElements = container.children.length - pendingCount;
        regionRef.current = {
          region: {
            top: container.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop,
            height: regionHeight(container, eagerElements),
            scrollTop: scroller.scrollTop,
          },
          eagerElements,
        };
      }
      if (urgent) setSwapped(true);
      else startTransition(() => setSwapped(true));
    });
  }, [pendingCount, scrollerRef, anchoring]);

  // Safari keeps the reader's place in the swap's own commit, before paint
  // (scroll-keep.ts). Chrome and Firefox never measured, so never get here.
  useLayoutEffect(() => {
    if (!swapped) return;
    const measured = regionRef.current;
    const container = containerRef.current;
    regionRef.current = null;
    if (!measured || !container || !keepPlace) return;
    const fix = scrollCorrection(measured.region, regionHeight(container, measured.eagerElements), {
      atBottom: atBottomRef?.current ?? false,
      anchoring,
    });
    if (fix !== 0) keepPlace(fix);
  }, [swapped, atBottomRef, keepPlace, anchoring]);

  return (
    <div ref={containerRef} className={cn(PROSE_CLASS, className)}>
      {blocks.map((block, index) =>
        index < pendingCount ? (
          <PendingBlock key={index} content={block} />
        ) : (
          <MarkdownBlock
            key={index}
            content={block}
            animate={animate && index >= blocks.length - ANIMATED_TAIL_BLOCKS}
          />
        ),
      )}
    </div>
  );
});
