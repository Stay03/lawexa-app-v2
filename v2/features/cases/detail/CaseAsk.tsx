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
 * The case page's chat surface, in two pieces the screen composes:
 *
 *  • {@link CaseAskDock} — the composer, FLOATING over the reading (owner,
 *    July 29: "the chat text area in the view case page is at the bottom of
 *    the page instead of floating on the page like it is in the message
 *    conversation page"). It rides the home tabs' proven sticky-dock mechanic
 *    (`sticky bottom-0` inside the shell's one scroll region + a gradient that
 *    dissolves content scrolling behind it), so the composer is reachable the
 *    whole read, on every breakpoint — never `position: fixed`.
 *  • {@link CaseChatsSection} — the reader's own prior threads about this case,
 *    in the document flow. This is the v1 feature the owner kept ("I need the
 *    features, it's the design I don't need"): v1 buried the list inside its
 *    floating panel's second chat engine; v2 lists the same threads as plain
 *    rows into the REAL conversation screen.
 *
 * ── ONE CHAT SYSTEM ─────────────────────────────────────────────────────────
 * Nothing about chat is reimplemented here. The dock submits through the same
 * `HomeComposer` → `startConversation` path as the home, tagged with
 * `references: [{ type: 'case' }]`, and hands the reader to `/c/{id}` — the
 * one conversation screen. The reference is also what makes the threads below
 * findable (`GET /cases/{slug}/conversations`).
 */

/** Openers worth one tap. Deliberately few — a wall of chips is a menu. */
const PROMPTS = [
  'Explain this case in plain language',
  'What is the ratio decidendi?',
  'How has this case been treated since?',
] as const;

export function CaseAskDock({
  slug,
  title,
  signedIn,
  role,
}: {
  slug: string;
  /** The readable case name — the placeholder carries the context. */
  title: string;
  signedIn: boolean;
  role: UserRole | null;
}) {
  const [draft, setDraft] = useState('');
  // Confidential is controlled by the parent everywhere this composer is used;
  // on a case page there is no greeting to present it, so it lives here.
  const [confidential, setConfidential] = useState(false);

  return (
    // `mt-auto` pins the dock to the viewport bottom even on a short case;
    // `sticky bottom-0` floats it while the judgment scrolls behind. The
    // negative margin + padding pair lets the gradient bleed to the column
    // edges, exactly like the home dock.
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-3 pt-8">
      {/* Dissolve the text scrolling behind the pill instead of colliding with
          it — every breakpoint, since the dock floats on all of them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent"
      />

      {/* Case-shaped openers — one tap fills the composer, the reader edits or
          sends. Desktop-only: on a phone the dock must stay one thumb-row tall. */}
      <ul className="mb-2 hidden flex-wrap gap-1.5 sm:flex">
        {PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => setDraft(prompt)}
              className={cn(
                'v2-interactive inline-flex min-h-8 items-center rounded-full border border-border bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>

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
    </div>
  );
}

/**
 * The reader's own threads about this case. Owner-scoped on the server, and
 * viewer-partitioned in the cache for the same reason every other list is: a
 * shared device must never paint the previous account's chat titles.
 *
 * Renders NOTHING when there are none — the one place in v2 where an empty
 * region is allowed to vanish rather than show a designed empty state, because
 * it is not a promised slot: the dock below already says what to do, and an
 * empty "no chats yet" line would be pure noise. It is also the LAST block in
 * the flow, so nothing is yanked upward when it resolves empty.
 */
export function CaseChatsSection({
  slug,
  viewerId,
}: {
  slug: string;
  viewerId: number | null;
}) {
  const query = useQuery(casesQueries.conversations(slug, { viewerId }));
  const [now] = useState(() => Date.now());
  const rows = query.data?.data ?? [];

  if (query.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40 rounded" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    );
  }

  // An error here is not worth a banner: the dock still works, and the threads
  // are reachable from /conversations. Fail quiet, never fail loud on a
  // secondary read.
  if (query.isError || rows.length === 0) return null;

  return (
    <section
      aria-label="Your chats about this case"
      className="flex flex-col gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <div className="px-1">
        <h2 className="doc-heading">Your chats about this case</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick one up where you left it, or ask something new below.
        </p>
      </div>
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
    </section>
  );
}
