'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Channel } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { channelVisibilityFace } from '@/lib/collab/visibility';
import { channelDisplayName } from '../thread-model';

/**
 * ChannelAboutSheet — what the channel IS, on the surface its name opens.
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 * Phase 3 of the mobile overhaul took a phone channel screen from two pinned
 * bars down to one. The things the second bar carried had to go somewhere
 * honest: the description (which was a one-line truncation with a disclosure
 * that changed the bar's height mid-read), who can see the channel, and the
 * space it belongs to. They live here, whole, behind the one tap that every
 * chat app already trains a reader to make — Slack, Discord, WhatsApp,
 * Telegram, Messages, Teams and Signal all open a details surface from the
 * conversation's name.
 *
 * It is a `?panel=` value like every other panel over this channel, so Back
 * closes it and a copied link opens it, and it needs no rules of its own.
 *
 * ── IT DOES NOT DUPLICATE THE ROSTER ───────────────────────────────────────
 * Members have their own panel with its own verbs. This one carries a way in
 * and the member count, and hands over rather than reprinting a list that
 * would then be maintained twice.
 */
export function ChannelAboutSheet({
  channel,
  open,
  onOpenChange,
  onOpenRoster,
}: {
  channel: Channel;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Absent where the roster is not readable, in which case the row is not
   *  offered rather than offered and refused. */
  onOpenRoster?: () => void;
}) {
  const displayName = channelDisplayName(channel);
  const description = channel.description?.trim() || null;
  const visibility = channelVisibilityFace(channel.visibility);
  const VisibilityIcon = visibility.icon;
  const total = channel.active_members_count;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Bottom, not side: this is a detail about the thing being read, and a
          bottom sheet is what a thumb reaches on a phone. The width rule is
          the side sheet's, so it must be stated for this side explicitly —
          `data-[side=bottom]` beats a bare utility (learned on the quiz
          library sheet). */}
      <SheetContent
        side="bottom"
        className="v2-safe-bottom max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <SpaceCrest
              uuid={channel.space.uuid}
              name={channel.space.name}
              type={channel.space.type}
              size="sm"
              className="size-10 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-left text-base">
                {displayName}
              </SheetTitle>
              <SheetDescription className="truncate text-left text-xs">
                in {channel.space.name}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-5 pb-6">
          {/* The description, WHOLE. On the bar it was one truncated line; the
              reason a reader opens this surface is to read the rest of it. */}
          {description ? (
            <p className="text-sm leading-relaxed text-foreground">{description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This channel has no description yet.
            </p>
          )}

          <dl className="flex flex-col gap-3 border-t pt-4">
            <div className="flex items-start gap-3">
              <VisibilityIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-sm font-medium text-foreground">
                  {channel.visibility_label}
                </dt>
                <dd className="text-xs text-muted-foreground">{visibility.description}</dd>
              </div>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            {onOpenRoster && (
              <button
                type="button"
                onClick={onOpenRoster}
                className={cn(
                  'v2-interactive flex min-h-11 items-center gap-3 rounded-xl border px-3 text-left',
                  FOCUS_RING,
                )}
              >
                <Users aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  People
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {total} {total === 1 ? 'member' : 'members'}
                </span>
              </button>
            )}

            <Link
              href={`/spaces/${channel.space.uuid}`}
              onClick={() => onOpenChange(false)}
              className={cn(
                'v2-interactive flex min-h-11 items-center gap-3 rounded-xl border px-3',
                FOCUS_RING,
              )}
            >
              <SpaceCrest
                uuid={channel.space.uuid}
                name={channel.space.name}
                type={channel.space.type}
                size="sm"
                className="size-5 shrink-0 rounded"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {channel.space.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">Open</span>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
