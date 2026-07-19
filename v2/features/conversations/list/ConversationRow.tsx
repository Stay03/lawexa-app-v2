'use client';

import Link from 'next/link';
import { ChevronRight, MessageSquare, ShieldCheck } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ConversationListItem } from '@/types/chat';
import {
  FOCUS_RING,
  REVEAL,
  RowIconTile,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';

/**
 * ConversationRow — one row of the `/conversations` list, built on the shared
 * home-module ROW ANATOMY (leading identity tile → title → trailing metadata,
 * calm hover-tint lift, ≥44px target, tabular time) so it reads as the same
 * system as the Work/Study strips, while carrying the three things a full list
 * row needs that a home strip doesn't:
 *
 *  - CONFIDENTIAL IDENTITY (§E redesign): a confidential conversation gets the
 *    emerald ShieldCheck tile — the same emerald language the conversation
 *    surface + header badge use — so v2's honesty about confidential chats is
 *    visible here, where v1 hid it. Everything else gets the neutral message
 *    tile (`RowIconTile`).
 *  - ARCHIVED badge (v1 parity): archived conversations are shown INLINE (this
 *    page is the only place they're reachable), marked with a quiet badge.
 *  - CHEVRON affordance (§E keep): a quiet trailing chevron that nudges on hover.
 *
 * The whole row is one `Link` to `/c/{id}` (proxied to the v2 conversation
 * screen). `now` is threaded in from the list's lazy `useState` initializer so
 * NO clock read runs in render (React Compiler purity) — the same lint-clean
 * pattern the module strips use. The staggered entrance uses the module `REVEAL`
 * token, which is `motion-safe`-gated (v1's stagger was not — a standing-rule
 * violation §E flags); `style.animationDelay` supplies the per-row stagger and
 * the animation only plays on MOUNT, so persisting rows never re-animate on a
 * search change.
 */
export function ConversationRow({
  conversation,
  now,
  index,
}: {
  conversation: ConversationListItem;
  now: number;
  index: number;
}) {
  const { id, title, status, updated_at, is_confidential } = conversation;
  const cleanTitle = stripPastedTags(title);
  const isArchived = status === 'archived';

  return (
    <li
      className={cn(REVEAL, 'duration-300')}
      // Cap the stagger at 14 rows (v1 parity) so a long list never waits on a
      // growing delay; motion-reduce drops the animation (token is motion-safe).
      // `duration-*` class + inline `animationDelay` is the module strips' idiom.
      style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
    >
      <Link
        href={`/c/${id}`}
        aria-label={`${cleanTitle}${is_confidential ? ' (confidential)' : ''}${isArchived ? ' (archived)' : ''}`}
        className={cn(
          'group v2-interactive flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60 active:bg-secondary',
          FOCUS_RING,
        )}
      >
        {is_confidential ? (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 transition-colors dark:text-emerald-400"
          >
            <ShieldCheck className="size-[18px]" />
          </span>
        ) : (
          <RowIconTile icon={MessageSquare} />
        )}

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {cleanTitle}
          </span>
          {is_confidential ? (
            <span className="truncate text-xs text-emerald-700 dark:text-emerald-400">
              Confidential
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {isArchived ? (
            <Badge variant="secondary" className="text-[11px]">
              Archived
            </Badge>
          ) : null}
          <span className="text-xs tabular-nums text-muted-foreground/80">
            {formatRelativeTime(updated_at, now)}
          </span>
          <ChevronRight
            aria-hidden
            className="size-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground motion-reduce:transition-none"
          />
        </span>
      </Link>
    </li>
  );
}
