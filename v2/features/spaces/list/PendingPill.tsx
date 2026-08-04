import Link from 'next/link';
import { Mail } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * PendingPill — the invitations entry, demoted from a permanent toolbar button
 * to something that only exists when there is something to answer.
 *
 * An always-visible "Invitations" button spends a top-level control on a state
 * that is empty for nearly every reader nearly always, and trains the eye to
 * skip the one place that occasionally matters. Its APPEARANCE is the signal.
 *
 * ── IT SAYS THE NUMBER IN WORDS, DELIBERATELY ──────────────────────────────
 * The old control carried a gold numeric badge. In this product A NUMBER IS
 * ONLY EVER MENTIONS (DIRECTION 2), so a second gold count for a second thing
 * quietly broke the one rule the whole surface is read by. "2 invitations" is
 * the same fact in the vocabulary already spoken here.
 *
 * ── IT IS ALWAYS MOUNTED, AND COLLAPSES BOTH WAYS ──────────────────────────
 * Rendering it conditionally would be an entrance with no matching exit — the
 * asymmetric motion the house rules forbid, and the reason `use-exiting-rows`
 * exists at all. So the pill is always in the tree and its WIDTH animates: the
 * standing `1fr ↔ 0fr` grid collapse (`EnablePushNudge`'s idiom, on columns
 * rather than rows) at 150ms, settling instantly under `motion-reduce`.
 * Collapsed it is `inert` and `aria-hidden`, so it leaves both the tab order
 * and the accessibility tree — a zero-width control nobody can reach, rather
 * than a hidden one they can tab into.
 *
 * ── AND IT SITS LEFT OF THE PRIMARY, WHICH IS WHY ──────────────────────────
 * The toolbar's right edge holds "New space". A late-resolving item placed
 * beside it would shove the primary action sideways on every visit that has a
 * pending invitation — a target moving under the thumb between two paints.
 * Expanding into the gap after the tabs pushes only empty space.
 */
export function PendingPill({ count }: { count: number }) {
  const open = count > 0;
  return (
    <div
      className={cn(
        'grid transition-[grid-template-columns,opacity] duration-150 ease-out motion-reduce:transition-none',
        open ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0',
      )}
    >
      <div className="overflow-hidden">
        <Link
          href="/invitations"
          aria-hidden={!open}
          inert={!open}
          className={cn(
            'v2-interactive inline-flex min-h-8 w-max items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-foreground',
            'transition-colors duration-150 hover:bg-primary/20 motion-reduce:transition-none',
            FOCUS_RING,
          )}
        >
          <Mail aria-hidden className="size-3.5 shrink-0" />
          {count === 1 ? '1 invitation' : `${count} invitations`}
        </Link>
      </div>
    </div>
  );
}
