'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserRole } from '@/types/auth';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { HomeComposer } from '@/v2/shell/designs/HomeComposer';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { casesQueries } from '../queries';

/**
 * CaseAsk — "ask Lawexa about this case", and the reader's own prior threads
 * about it.
 *
 * ── ONE CHAT SURFACE ────────────────────────────────────────────────────────
 * v1 answered this with a SECOND chat implementation: a floating pill that
 * opened a sheet containing its own SSE handling, its own message renderer, its
 * own tool-call rendering and its own conversation list — around 800 lines that
 * had already drifted from the real conversation page (different thinking
 * indicator, legacy stream mode, no reasoning traces).
 *
 * v2 has a conversation page worth going to. So this creates a NORMAL
 * conversation — same composer, same `startConversation`, same privacy and
 * jurisdiction rules as the home — tagged with `references: [{ type: 'case' }]`,
 * and hands the reader to `/c/{id}`. Nothing about chat is reimplemented here.
 * The reference is what makes those threads findable again, which is what the
 * list below reads.
 *
 * ── WHY IT IS INLINE, NOT FLOATING ──────────────────────────────────────────
 * A deliberate change from v1, and the one most worth a second opinion. A
 * composer floating over a judgment covers the text being read, and a judgment is
 * the one page where the words matter most. Placed at the end, it is where a
 * reader arrives when they have read enough to have a question. If it turns out
 * people want to ask mid-read, the fix is a floating layer like the conversation
 * screen's — the create path would not change.
 */

/** Openers worth one tap. Deliberately few — a wall of chips is a menu. */
const PROMPTS = [
  'Explain this case in plain language',
  'What is the ratio decidendi?',
  'How has this case been treated since?',
] as const;

export function CaseAsk({
  slug,
  title,
  signedIn,
  viewerId,
  role,
}: {
  slug: string;
  title: string;
  signedIn: boolean;
  viewerId: number | null;
  role: UserRole | null;
}) {
  const [draft, setDraft] = useState('');
  // Confidential is controlled by the parent everywhere this composer is used;
  // on a case page there is no greeting to present it, so it lives here.
  const [confidential, setConfidential] = useState(false);

  return (
    <section aria-label="Ask about this case" className="flex flex-col gap-4">
      <div>
        <h2 className="doc-heading">Ask about this case</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your question opens a new chat that already knows this case.
        </p>
      </div>

      <HomeComposer
        value={draft}
        onValueChange={setDraft}
        signedIn={signedIn}
        role={role ?? undefined}
        confidential={confidential}
        onConfidentialChange={setConfidential}
        references={[{ type: 'case', id: slug }]}
        placeholder={`Ask about ${title}`}
        textareaClassName="text-[15px]"
        sendButtonClassName="md:size-9"
      />

      <ul className="flex flex-wrap gap-1.5">
        {PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => setDraft(prompt)}
              className={cn(
                'v2-interactive inline-flex min-h-8 items-center rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>

      {signedIn ? <CaseChats slug={slug} viewerId={viewerId} /> : null}
    </section>
  );
}

/**
 * The reader's own threads about this case. Owner-scoped on the server, and
 * viewer-partitioned in the cache for the same reason every other list is: a
 * shared device must never paint the previous account's chat titles.
 *
 * Renders NOTHING when there are none — the one place in v2 where an empty
 * region is allowed to vanish rather than show a designed empty state, because
 * it is not a promised slot: the composer above it already says what to do, and
 * an empty "no chats yet" line under it would be pure noise. It is also below
 * everything, so nothing is yanked upward when it resolves.
 */
function CaseChats({ slug, viewerId }: { slug: string; viewerId: number | null }) {
  const query = useQuery(casesQueries.conversations(slug, { viewerId }));
  const [now] = useState(() => Date.now());
  const rows = query.data?.data ?? [];

  if (query.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-2 pt-1">
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    );
  }

  // An error here is not worth a banner: the composer above still works, and the
  // threads are reachable from /conversations. Fail quiet, never fail loud on a
  // secondary read.
  if (query.isError || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 pt-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <h3 className="px-1 text-xs font-medium text-muted-foreground">
        Your chats about this case
      </h3>
      <ul className="flex flex-col divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/c/${row.id}`}
              className={cn(
                'v2-interactive flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/50',
                FOCUS_RING,
              )}
            >
              <MessageSquare
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground/70"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {stripPastedTags(row.title) || 'Untitled conversation'}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                {formatRelativeTime(row.updated_at, now)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
