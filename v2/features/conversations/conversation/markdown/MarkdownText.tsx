'use client';

import { memo, useMemo } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { CaseMentionLink } from './CaseMentionLink';
import { rehypeStreamWords } from './rehype-stream-words';

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
 * Each `<ReactMarkdown>` renders its block elements as direct children (react-markdown
 * v10 renders a fragment, no wrapper), so all blocks are direct children of the one
 * prose container and prose vertical rhythm is preserved across block boundaries.
 *
 * WORD FADE (`animate`). Live streaming text is released in whole WORDS by the
 * smoother, which cuts the publish rate from ~60/s to ~23/s; the sub-word smoothness
 * that buys back is supplied by a compositor-only opacity fade on each newly-mounted
 * word, injected by the {@link rehypeStreamWords} rehype plugin. Both pipelines are
 * module-level constants and are passed to `MarkdownBlock` as a PROP, so the
 * per-block memo still holds within a mode and still invalidates when the mode flips
 * — which is what guarantees a finished message ends up with zero span overhead.
 */

// Stable module-level plugin list — a fresh array each render would defeat memo.
const REMARK_PLUGINS = [remarkBreaks, remarkGfm];

/**
 * The two rehype pipelines, BOTH module-level constants (the memo constraint: a
 * fresh array per render gives every `MarkdownBlock` a new prop identity and
 * silently defeats the per-block `React.memo`, turning the streaming pipeline's
 * biggest win into a large regression).
 *
 * `animate` selects between them, and because the choice is a stable REFERENCE the
 * memo still holds within a mode AND correctly invalidates on the mode change — so
 * a finished message re-renders exactly once, with zero word spans left in its DOM
 * ({@link rehypeStreamWords}).
 */
const REHYPE_ANIMATED: Options['rehypePlugins'] = [rehypeStreamWords];
const REHYPE_PLAIN: Options['rehypePlugins'] = [];

/**
 * Stable module-level component overrides. MUST be defined once at module scope —
 * a fresh `components` object per render would give every `MarkdownBlock` a new
 * prop identity and defeat the per-block `React.memo` streaming pipeline. It
 * overrides only `a`, routing case-mention links through the preview (hover-card
 * on pointer devices, tap popover on touch); every other anchor renders exactly
 * as react-markdown's default. {@link CaseMentionLink} holds no data hook, so a
 * token flush never fetches or re-renders beyond the block already re-parsing.
 */
const MARKDOWN_COMPONENTS: Components = { a: CaseMentionLink };

const PROSE_CLASS =
  'prose prose-sm dark:prose-invert max-w-none overflow-x-hidden break-words ' +
  '[&_a]:text-primary [&_a.case-mention]:no-underline ' +
  '[&_code]:bg-muted [&_pre]:bg-muted [&_pre]:overflow-x-auto [&_pre]:overscroll-x-contain';

/** Split markdown into independently-renderable blocks (blank-line separated),
 *  never splitting inside a fenced code block. Pure — safe to call in render. */
function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let fenceChar = '';

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    }
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
      } else if (marker === fenceChar) {
        inFence = false;
      }
      current.push(line);
      continue;
    }
    if (!inFence && line.trim() === '') {
      flush();
    } else {
      current.push(line);
    }
  }
  flush();
  return blocks.length > 0 ? blocks : [text];
}

const MarkdownBlock = memo(function MarkdownBlock({
  content,
  rehypePlugins,
}: {
  content: string;
  rehypePlugins: Options['rehypePlugins'];
}) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={rehypePlugins}
      components={MARKDOWN_COMPONENTS}
    >
      {content}
    </ReactMarkdown>
  );
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
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content]);
  const rehypePlugins = animate ? REHYPE_ANIMATED : REHYPE_PLAIN;
  return (
    <div className={cn(PROSE_CLASS, className)}>
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} content={block} rehypePlugins={rehypePlugins} />
      ))}
    </div>
  );
});
