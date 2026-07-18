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
 *     note under the composer. SMOOTH MOTION (owner rule #17): the heading colour
 *     transitions, its text cross-fades (keyed remount → `animate-in fade-in`), and
 *     the sub-copy expands/collapses via the grid-rows technique. Every transition
 *     is `motion-reduce`-guarded (and tw-animate-css `animate-in` is nulled under
 *     reduced motion by the globals guard).
 */

const CONFIDENTIAL_HEADING = 'Confidential Chat';
const CONFIDENTIAL_SUBLINE =
  'For privileged legal discussions and sensitive client matters. Chats are not stored after your session.';

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
  // The active sub-copy: confidential copy wins; otherwise the design's own line
  // (which may be absent for Design A).
  const sublineText = confidential ? CONFIDENTIAL_SUBLINE : subline;

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
          <h1
            // Keyed on the confidential flag so the text swap remounts and plays a
            // short fade-in; the colour tweens via transition-colors.
            key={confidential ? 'confidential' : 'greeting'}
            className={cn(
              'transition-colors duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
              confidential ? 'text-emerald-600 dark:text-emerald-500' : 'text-foreground',
              headingClassName,
            )}
          >
            {confidential ? (
              CONFIDENTIAL_HEADING
            ) : parts.isSpecial === '__PULSING_HEART__' ? (
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
          </h1>

          {/* Sub-copy — expands/collapses smoothly (grid-rows 0fr↔1fr) so it never
              just appears or disappears; the text itself cross-fades on swap. */}
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
              sublineText ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              {sublineText ? (
                <p
                  key={confidential ? 'confidential-sub' : 'default-sub'}
                  className={cn(
                    'mt-2 text-sm text-muted-foreground md:text-base motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
                    centered && 'mx-auto max-w-md',
                  )}
                >
                  {sublineText}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
