'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, MessageSquare } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { Skeleton } from '@/components/ui/skeleton';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { startConversation } from '@/v2/features/conversations/start-conversation';
import { casesQueries } from '../queries';

/**
 * CaseAskDock — the case page's chat TRIGGER, plus the shared pieces the chat
 * surface's new-chat view uses (`useStartCaseChat`, `RecentCaseChats`,
 * `CASE_PROMPTS`).
 *
 * ── ONE ENTRY, ONE SURFACE (owner, July 31: "make it one put-together
 * system") ──────────────────────────────────────────────────────────────────
 * This used to be a real composer with a popup hub above it — a SECOND
 * surface that duplicated the chat's new-chat view with different geometry
 * and NO URL state. Both are gone: the pill is now a trigger drawn in the
 * composer's exact clothes (the gold-shimmer ring, the row metrics, the gold
 * send circle), and pressing it opens the chat surface in its new-chat view
 * (`?chat=new`) at every width — the floating card on desktop, the sheet on
 * mobile. Typing, prompts, jurisdiction, recents: they all live in that ONE
 * surface, which always has URL state, so Back always closes it.
 */

export const CASE_PROMPTS = [
  'Explain this case in plain language',
  'What is the ratio decidendi?',
  'How has this case been treated since?',
] as const;

/**
 * The one way a case chat starts: draft + jurisdiction in, conversation out,
 * with the "your chats about this case" query refreshed. Used by the chat
 * surface's new-chat view; lives here beside the trigger so the case-chat
 * entry pieces stay one module.
 */
export function useStartCaseChat(
  slug: string,
  signedIn: boolean,
  onOpened: (conversationId: string) => void,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (draft: string, jurisdiction: JurisdictionChoice) => {
    const message = draft.trim();
    if (!message || isSubmitting) return false;
    if (!signedIn) {
      router.push('/login');
      return false;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await startConversation(
        {
          message,
          attachments: [],
          jurisdiction,
          references: [{ type: 'case', id: slug }],
        },
        { queryClient },
      );
      // Refresh "your chats about this case" so the new thread is listed the
      // next time the new-chat view opens.
      void queryClient.invalidateQueries({
        queryKey: [...casesQueries.all, 'conversations', slug],
      });
      // The embedded controller consumes the `conv_init` handoff
      // `startConversation` just wrote, so the stream attaches in the panel.
      onOpened(result.conversationId);
      // `isSubmitting` stays true through the swap — no double-submit window.
      return true;
    } catch (err) {
      setError(extractApiError(err).message);
      setIsSubmitting(false);
      return false;
    }
  };

  return { submit, isSubmitting, error, clearError: () => setError(null) };
}

export function CaseAskDock({
  onOpenChat,
}: {
  /** Open the chat surface — the trigger always opens the new-chat view. */
  onOpenChat: (chatId: string) => void;
}) {
  return (
    // The fade-in matters on the SECOND mount: the trigger returns only after
    // the chat surface finishes its exit, and easing in reads as the hand-off
    // it is rather than a pop.
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-3 pt-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {/* Dissolve the judgment scrolling behind the pill — dense at the pill,
          gone by the top, so text fades out instead of running at full ink
          straight into the trigger. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background from-35% via-background/80 to-transparent"
      />

      {/* The trigger, in the composer's exact clothes: the gold-shimmer ring,
          the p-2 body, the min-h-9 text row, the size-8 gold circle. One
          press opens the chat surface ready to type. */}
      <button
        type="button"
        onClick={() => onOpenChat('new')}
        className={cn(
          'v2-interactive mx-auto block w-full max-w-xs rounded-3xl text-left shadow-[0_6px_16px_-8px_rgba(0,0,0,0.28)] sm:max-w-md',
          FOCUS_RING,
        )}
      >
        <span className="gold-shimmer block rounded-3xl p-[1px]">
          <span className="flex items-end gap-1.5 rounded-3xl bg-background p-2">
            <span className="min-h-9 flex-1 px-2 py-2 text-base leading-none text-muted-foreground">
              Ask about this case
            </span>
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <ArrowUp className="size-4" />
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}

/**
 * The reader's recent threads about this case. Owner-scoped on the server and
 * viewer-partitioned in the cache; renders nothing when there are none and
 * fails quiet — the threads are still reachable from /conversations. Rows
 * open in the chat surface (buttons, not links): resuming a thread about the
 * case keeps the case.
 */
export function RecentCaseChats({
  slug,
  viewerId,
  onOpenChat,
  limit = 3,
}: {
  slug: string;
  viewerId: number | null;
  onOpenChat: (conversationId: string) => void;
  limit?: number;
}) {
  const query = useQuery(casesQueries.conversations(slug, { viewerId }));
  const [now] = useState(() => Date.now());
  const rows = (query.data?.data ?? []).slice(0, limit);

  if (query.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    );
  }
  if (query.isError || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        Pick up where you left off
      </p>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpenChat(row.id)}
              className={cn(
                'v2-interactive flex w-full min-h-9 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-secondary/60',
                FOCUS_RING,
              )}
            >
              <MessageSquare
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/70"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {stripPastedTags(row.title) || 'Untitled conversation'}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                {formatRelativeTime(row.updated_at, now)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
