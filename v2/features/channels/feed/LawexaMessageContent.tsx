'use client';

import { useMemo, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import { buildMentionChips } from '@/lib/utils/collab';
import type { MessageMetadata } from '@/types/collab';
import { rehypeChannelMentions } from './rehype-mentions';

/**
 * LawexaMessageContent — the body renderer for `is_ai` messages in a channel.
 * Phase-5 W3; a port of v1's component onto the v2 feed (v1 feature components
 * are boundary-blocked). Sources: study A9 ("replies as markdown with mention
 * chips" — KEEP), plan W3 item 5 — 2026-08-04.
 *
 * THIS CLOSES THE RAW-ASTERISKS GAP. Until now every Lawexa reply flowed
 * through the plain-text path, so the model's `**bold**`, tables and lists
 * reached the reader as punctuation. Markdown is not decoration for a legal
 * answer: numbered points, emphasis on the operative words and a table of
 * authorities ARE the content's structure.
 *
 * WHY NOT THE CONVERSATION'S `MarkdownText`. That renderer is built for a
 * STREAM — it splits into blocks and memoises each one so a token re-parses one
 * block, and its rehype pipelines are module-level constants exactly so the
 * per-block memo can hold. Mention chips need a PER-MESSAGE plugin (the handle
 * map is the message's own resolved list), which that design deliberately has
 * no room for. Channel AI messages arrive finished, never streamed, so nothing
 * of that machinery would earn its cost here: one parse per message, memoised
 * at the row (rows are `memo`'d on the message reference), is the honest fit.
 *
 * TWO CHIP WEIGHTS, MATCHING THE PLAIN-TEXT PATH: a mention of the VIEWER
 * renders filled and readable; a mention of anyone else is a quiet gold tint.
 * Both are styled here rather than in the plugin so the two renderers hold one
 * visual definition (`MessageContent` uses the same two class pairs). Which
 * weight applies is decided by UUID inside the plugin — see its docblock for
 * why a display-name comparison could not survive usernames.
 */

/** `react-markdown` doesn't re-export `PluggableList`; derive it from the prop. */
type PluginList = NonNullable<ComponentProps<typeof ReactMarkdown>['rehypePlugins']>;

/** Stable module-level list — a fresh array per render re-parses for nothing. */
const REMARK_PLUGINS: PluginList = [remarkGfm, remarkBreaks];

/**
 * Prose sized and coloured for the FEED, not for the conversation screen: the
 * same 0.9375rem body as a human message so an AI answer sits in the transcript
 * rather than on top of it, with tables, code and quotes kept inside the
 * message column (a wide table scrolls itself instead of stretching the feed).
 */
const PROSE_CLASS = cn(
  'prose prose-sm dark:prose-invert max-w-none break-words',
  'text-[0.9375rem] leading-relaxed text-foreground',
  'prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-[0.95rem]',
  'prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5',
  'prose-pre:my-2 prose-pre:bg-muted prose-pre:overflow-x-auto prose-pre:overscroll-x-contain',
  'prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-normal',
  'prose-code:before:content-none prose-code:after:content-none',
  'prose-a:text-primary prose-a:underline-offset-2',
  'prose-blockquote:border-l-primary/40 prose-blockquote:not-italic',
  'prose-table:block prose-table:overflow-x-auto prose-table:overscroll-x-contain prose-table:text-sm',
  // The mention chips the rehype plugin emits — quiet gold for anyone,
  // filled + readable when it is the reader who was named.
  '[&_.lawexa-mention]:rounded [&_.lawexa-mention]:px-1 [&_.lawexa-mention]:font-medium',
  '[&_.lawexa-mention]:bg-primary/10 [&_.lawexa-mention]:text-primary',
  '[&_.lawexa-mention[data-self]]:bg-primary/20 [&_.lawexa-mention[data-self]]:text-foreground',
);

/** The prose shell both entry points render through — one visual definition of
 *  "a Lawexa answer", whatever resolved the mentions in it. */
function LawexaProse({
  content,
  rehypePlugins,
}: {
  content: string;
  rehypePlugins?: PluginList;
}) {
  return (
    <div className={PROSE_CLASS}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={rehypePlugins}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function LawexaMessageContent({
  content,
  metadata,
  viewerUuid,
}: {
  content: string;
  metadata: MessageMetadata;
  /** For the self-mention emphasis; `null` mutes the distinction. */
  viewerUuid: string | null;
}) {
  const rehypePlugins = useMemo<PluginList>(
    () => [rehypeChannelMentions(buildMentionChips(metadata), viewerUuid)],
    [metadata, viewerUuid],
  );

  return <LawexaProse content={content} rehypePlugins={rehypePlugins} />;
}

/**
 * The same answer, rendered for a resource that carries NO resolved mention
 * list — the AI session transcript, whose rows are conversation rows rather
 * than messages (`AiTranscriptMessage`). Without the server's resolution there
 * is nothing to highlight, and the "never guess a mention" rule forbids
 * inventing one, so `@tokens` stay literal text inside the markdown.
 */
export function LawexaMarkdown({ content }: { content: string }) {
  return <LawexaProse content={content} />;
}
