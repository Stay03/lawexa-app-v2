'use client';

import { useMemo, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { buildMentionHandleMap } from '@/lib/utils/collab';
import { rehypeLawexaMentions } from '@/lib/utils/lawexa-mentions';
import type { MessageMetadata } from '@/types/collab';

interface LawexaMessageContentProps {
  content: string;
  metadata: MessageMetadata;
}

/** `react-markdown` doesn't re-export `PluggableList`; derive it from the prop. */
type PluginList = NonNullable<ComponentProps<typeof ReactMarkdown>['rehypePlugins']>;

const REMARK_PLUGINS: PluginList = [remarkGfm, remarkBreaks];

/**
 * Prose container for Lawexa's markdown replies. The `.lawexa-mention` chips are
 * styled to match the human mention chip exactly
 * (`rounded bg-primary/10 px-1 font-medium text-primary`); code and links keep
 * the same treatment as the personal-chat prose.
 */
const PROSE_CLASS =
  'prose prose-sm dark:prose-invert max-w-none break-words ' +
  '[&_.lawexa-mention]:rounded [&_.lawexa-mention]:bg-primary/10 ' +
  '[&_.lawexa-mention]:px-1 [&_.lawexa-mention]:font-medium ' +
  '[&_.lawexa-mention]:text-primary ' +
  '[&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted [&_pre]:overflow-x-auto';

/**
 * Renders a Lawexa (`is_ai`) message as markdown with resolved `@mentions`
 * highlighted. Human messages continue to use `MessageContent`; this path is
 * markdown-only and used exclusively for AI replies.
 */
export function LawexaMessageContent({
  content,
  metadata,
}: LawexaMessageContentProps) {
  const rehypePlugins = useMemo<PluginList>(
    () => [rehypeLawexaMentions(buildMentionHandleMap(metadata))],
    [metadata]
  );

  return (
    <div className={PROSE_CLASS}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={rehypePlugins}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
