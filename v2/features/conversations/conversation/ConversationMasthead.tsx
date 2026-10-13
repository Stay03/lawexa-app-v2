'use client';

import Link from 'next/link';
import { Boxes, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useHeaderContext } from '@/v2/shell/header-context';
import { useHeaderPlace } from '@/v2/shell/header-place';

/**
 * ConversationMasthead — a chat's heading at the top of its transcript: the
 * title, and the space it is in as a link to the space.
 *
 * A chat wears the list pages' open bar (Stay, 13 October 2026: "remove the
 * header from the top both here and regular single user chat too. it should
 * look like the list page"), so its title is in the page, the way a list's is
 * (`ScreenTitle`), and scrolls away with the messages under the bar's buttons.
 *
 * It reads the same two stores the bar's centre read: the title the
 * controller publishes (and a tap from a list publishes before the screen
 * mounts, so it shows from the first frame), and the place `ConversationActions`
 * publishes. Until the title resolves, a title-shaped shimmer holds its line.
 */
export function ConversationMasthead() {
  const { title, confidential } = useHeaderContext();
  const place = useHeaderPlace();

  return (
    <header className="flex min-w-0 flex-col gap-1.5">
      {title === null ? (
        <div aria-hidden className="h-7 w-2/3 animate-pulse rounded-full bg-muted" />
      ) : (
        <h1 className="line-clamp-3 text-balance text-xl font-semibold leading-snug tracking-tight text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 sm:text-2xl">
          {title}
          {confidential ? (
            <ShieldCheck
              aria-label="Confidential"
              className="ml-1.5 inline size-4 -translate-y-px align-middle text-emerald-600 dark:text-emerald-500"
            />
          ) : null}
        </h1>
      )}
      {place ? (
        <Link
          href={place.href}
          aria-label={`Open the space ${place.label}`}
          className={cn(
            'v2-interactive inline-flex min-w-0 max-w-full items-center gap-1.5 self-start rounded text-sm text-muted-foreground transition-colors hover:text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
            FOCUS_RING,
          )}
        >
          <Boxes aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{place.label}</span>
        </Link>
      ) : null}
    </header>
  );
}
