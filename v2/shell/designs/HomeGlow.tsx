'use client';

import { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useHomeTab, useHomeTabSwaps } from '@/v2/shell/home-tab';

/**
 * HomeGlow — the ambient warm spotlight behind the home, and the home's tab-switch
 * loading state.
 *
 * ── WHY IT LEFT `ChatHome` ──────────────────────────────────────────────────
 * The light used to be a child of the Chat surface. The surfaces key-remount on a
 * tab swap, so switching Chat → Work unmounted the glow in the same frame the swap
 * began — the owner saw it "show then immediately disappear when the new tab is
 * loading". The light was gone before the thing it should have been covering had
 * even started.
 *
 * It now lives in the PERSISTENT home wrapper (`app/v2/home.tsx`), outside the
 * cross-fade, so a tab swap cannot take it with it. That single move is what lets
 * it behave the way the owner asked: stay lit through the swap, hold while the
 * incoming tab loads, and only then settle away.
 *
 * ── WHAT "FULLY LOADED" MEANS, AND WHY IT IS MEASURED NOT GUESSED ───────────
 * The Work and Study tabs are made of independent modules, each owning its own
 * query, so there is no single "tab ready" moment to hook. `useIsFetching()` is
 * that moment, already maintained by the query layer: it is the live count of
 * in-flight queries, so zero means every module on the new tab has its data.
 *
 * Two bounds keep it honest:
 *  • A SETTLE beat after the count reaches zero, so a tab whose modules are all
 *    warm still shows the light through the swap instead of blinking it out. This
 *    matters more than it used to — list queries now re-check on every arrival
 *    (`REFETCH_ON_VISIT`), so a switch nearly always fetches something, but a
 *    fully-cached tab must not be a worse experience than a slow one.
 *  • A hard CAP. `useIsFetching()` is global, so an unrelated background
 *    revalidation could otherwise hold the light lit indefinitely. The glow is a
 *    transition, not a progress bar; it must always end.
 *
 * ── IT IS HELD, NEVER LIT ───────────────────────────────────────────────────
 * The hold carries over whatever is lit at the moment the user presses a tab. So
 * leaving Chat holds the light; leaving Work for Study, with nothing lit, holds
 * nothing. The glow is never introduced to a tab that did not have it — that would
 * be a new effect nobody asked for rather than the continuity the owner described.
 *
 * ── MOTION ──────────────────────────────────────────────────────────────────
 * The OUTER element keeps the approved ~2.2s mount bloom (owner #36: the earlier
 * ~700ms "read as a flash"), so a fresh home is unchanged — first frame fully dim,
 * light gathering slowly. The INNER element owns visibility, so the two never
 * fight: arriving at Chat gathers over the same 2.2s the owner approved, and
 * settling away takes a slower-than-noticeable 900ms. Both directions animate
 * (standing rule #24); reduced motion drops both and just shows the light.
 */

/** Quiet beat after the last query settles, so a warm tab never blinks the light out. */
const SETTLE_MS = 400;
/**
 * Ceiling on the hold. `useIsFetching()` is global — a long unrelated background
 * request must not strand the light on. A transition always ends.
 */
const MAX_HOLD_MS = 6000;

export function HomeGlow() {
  const tab = useHomeTab();
  const swaps = useHomeTabSwaps();
  const fetching = useIsFetching();

  const [holding, setHolding] = useState(false);
  const [seenSwaps, setSeenSwaps] = useState(swaps);

  const visible = tab === 'chat' || holding;

  // React's sanctioned "adjust state during render". No effect: an effect would
  // start the hold one commit LATE — after the frame that already dropped the
  // light, which is the exact flicker being fixed.
  //
  // KEYED ON THE SWAP COUNT, NOT ON `tab`. The tab VALUE also changes on the
  // post-hydration reconcile (the store's server snapshot is always `'chat'`), so a
  // device whose stored tab is Work would light a glow on every hard load. The
  // counter only moves when the user actually presses a tab.
  //
  // `visible` is what carries over — whatever is lit at the moment of the press
  // stays lit. That is one rule for every case: leaving Chat holds the light;
  // leaving Work→Study while nothing is lit holds nothing (no new effect appears
  // that the owner did not ask for); and a second press mid-hold extends the hold
  // rather than dropping it half-way.
  if (seenSwaps !== swaps) {
    setHolding(visible);
    setSeenSwaps(swaps);
  }

  // Release once the incoming tab has stopped fetching and stayed quiet for a beat.
  // Re-runs whenever the count changes, so a new request restarts the beat.
  useEffect(() => {
    if (!holding || fetching > 0) return;
    const id = setTimeout(() => setHolding(false), SETTLE_MS);
    return () => clearTimeout(id);
  }, [holding, fetching]);

  // The ceiling, as its own effect so it is armed once per hold and is never reset
  // by fetch-count churn.
  useEffect(() => {
    if (!holding) return;
    const id = setTimeout(() => setHolding(false), MAX_HOLD_MS);
    return () => clearTimeout(id);
  }, [holding]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both motion-safe:duration-[2200ms] motion-safe:ease-out"
    >
      <div
        className={cn(
          'absolute inset-0 ease-out motion-safe:transition-opacity',
          visible
            ? 'opacity-100 motion-safe:duration-[2200ms]'
            : 'opacity-0 motion-safe:duration-[900ms]',
        )}
      >
        {/* Two layered radials — a wide static wash and a slower breathing core —
            give the light depth. Built only from the --primary token at low
            opacity. Positioned low on mobile (the composer docks at the thumb) and
            a touch below centre on desktop (tracking the composer's lower anchor,
            owner #33). Mobile layers are DIMMER below `md`; desktop opacities are
            the owner-approved ones, unchanged. Geometry is verbatim from ChatHome —
            the extraction changed nothing visual. */}
        <div className="absolute left-1/2 top-[70%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] bg-primary/[0.03] dark:bg-primary/[0.06] md:top-[46%] md:bg-primary/[0.06] md:dark:bg-primary/[0.12]" />
        <div
          className="absolute left-1/2 top-[72%] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] motion-safe:animate-pulse bg-primary/[0.06] dark:bg-primary/10 md:top-[48%] md:bg-primary/[0.12] md:dark:bg-primary/20"
          style={{ animationDuration: '7s' }}
        />
      </div>
    </div>
  );
}
