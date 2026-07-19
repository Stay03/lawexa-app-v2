'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { getSmartGreetingParts } from '@/lib/constants/greetings';
import { Skeleton } from '@/components/ui/skeleton';
import { PulsingHeart } from '@/components/ui/pulsing-heart';
import { useMounted } from '@/v2/shell/use-mounted';

/**
 * HomeGreeting — the shared greeting header for both home designs, owning three
 * things the owner called out:
 *
 *  1. v1's REAL smart greeting engine (`getSmartGreetingParts`): a randomized
 *     holiday/day/time greeting that differs per refresh, with probabilistic name
 *     inclusion and the `__PULSING_HEART__` special. Resolved once through a lazy
 *     `useState` initializer so the engine's `Math.random`/`Date` never run in the
 *     render body (React Compiler lint).
 *
 *  2. SKELETON-FIRST (owner rule #23): pre-mount — server + first client render —
 *     it shows a `Skeleton` sized to the greeting box (never the rejected
 *     'Welcome' string flash), then cross-fades to the real greeting once mounted.
 *     `useMounted` gives that server(false)/client(true) sequencing with no
 *     hydration mismatch.
 *
 *  3. CONFIDENTIAL MODE like v1 (owner #17): when confidential is on, the heading
 *     swaps to an emerald "Confidential Chat" and the v1 sub-copy appears — NOT a
 *     note under the composer.
 *
 * SYMMETRIC MOTION (owner #24 — the refinement that this round fixes): the old
 * build keyed-remounted the heading and sub-copy, so the ENTER animated but the
 * EXIT snapped (the removed node cannot animate). Everything here is now a
 * PERSISTENT-NODE cross-fade that animates BOTH directions:
 *
 *   - Heading: the greeting and the "Confidential Chat" line are two stacked
 *     layers in a single grid cell (both always mounted); toggling confidential
 *     cross-fades their opacity. Height stays at the taller layer, so the swap
 *     never reflows.
 *   - Sub-copy: two independent grid-rows collapsibles (confidential copy + the
 *     design's own line), each with CONSTANT text that stays mounted, so the text
 *     fades WHILE the row collapses/expands — symmetric in and out. They are
 *     mutually exclusive, so at most one is ever open.
 *
 * Every transition is `motion-reduce`-guarded.
 */

const CONFIDENTIAL_HEADING = 'Confidential Chat';
const CONFIDENTIAL_SUBLINE =
  'For privileged legal discussions and sensitive client matters. Stored only on this device until you delete it — never on our servers.';

interface HomeGreetingProps {
  name?: string;
  confidential: boolean;
  /** Typography + layout for the `<h1>` (Comfortaa scale differs per design). */
  headingClassName?: string;
  /** Non-confidential sub-copy (Design B has one; Design A passes none). */
  subline?: string;
  align?: 'center' | 'left';
  className?: string;
}

export function HomeGreeting({
  name,
  confidential,
  headingClassName,
  subline,
  align = 'center',
  className,
}: HomeGreetingProps) {
  const mounted = useMounted();
  const [parts] = useState(() => getSmartGreetingParts(name));

  const centered = align === 'center';

  return (
    <header className={cn(centered ? 'text-center' : 'text-left', className)}>
      {!mounted ? (
        // Skeleton sized to the greeting box so there is zero layout jump on the
        // cross-fade to real content.
        <div className={cn('flex flex-col gap-2', centered && 'items-center')}>
          <Skeleton className="h-8 w-56 rounded-lg sm:w-64 md:h-9 md:w-72" />
          {subline ? <Skeleton className="h-4 w-40 rounded md:w-52" /> : null}
        </div>
      ) : (
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {/* Heading — two stacked layers cross-fade on the confidential toggle.
              The <h1> is the single semantic heading; the inactive layer is
              aria-hidden so assistive tech reads only the visible one. */}
          <h1 className={cn('grid', headingClassName)}>
            <span
              aria-hidden={confidential}
              className={cn(
                'col-start-1 row-start-1 text-foreground transition-opacity duration-200 ease-out motion-reduce:transition-none',
                confidential ? 'opacity-0' : 'opacity-100',
              )}
            >
              {parts.isSpecial === '__PULSING_HEART__' ? (
                <PulsingHeart />
              ) : (
                <>
                  {parts.greeting}
                  {parts.name ? (
                    <>
                      {', '}
                      <span className="text-primary">{parts.name}</span>
                    </>
                  ) : null}
                </>
              )}
            </span>
            <span
              aria-hidden={!confidential}
              className={cn(
                'col-start-1 row-start-1 text-emerald-600 transition-opacity duration-200 ease-out motion-reduce:transition-none dark:text-emerald-500',
                confidential ? 'opacity-100' : 'opacity-0',
              )}
            >
              {CONFIDENTIAL_HEADING}
            </span>
          </h1>

          {/* Confidential sub-copy — its own collapsible (expands only when
              confidential). Text is constant + always mounted, so it fades while
              the row collapses/expands: symmetric both ways. */}
          <SublineCollapse
            expanded={confidential}
            centered={centered}
            text={CONFIDENTIAL_SUBLINE}
          />

          {/* The design's own sub-copy (Design B) — expands only when NOT
              confidential. Omitted entirely when the design has no subline
              (Design A), which is a stable prop, not a runtime toggle. */}
          {subline ? (
            <SublineCollapse
              expanded={!confidential}
              centered={centered}
              text={subline}
            />
          ) : null}
        </div>
      )}
    </header>
  );
}

/**
 * One sub-copy row that expands/collapses symmetrically: `grid-template-rows`
 * tweens 0fr↔1fr for the height and the text's opacity tweens in lockstep, so it
 * never just appears or disappears in either direction. The text is a constant
 * prop that stays mounted through the collapse (the fix for the enter-only exit).
 */
function SublineCollapse({
  expanded,
  centered,
  text,
}: {
  expanded: boolean;
  centered: boolean;
  text: string;
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        <p
          className={cn(
            'mt-2 text-sm text-muted-foreground transition-opacity duration-200 ease-out motion-reduce:transition-none md:text-base',
            expanded ? 'opacity-100' : 'opacity-0',
            centered && 'mx-auto max-w-md',
          )}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
