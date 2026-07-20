'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';

/**
 * Dock — lets a ROUTE fill the AppShell's bottom dock grid-row (grid-row 3,
 * outside the scroll container) from inside the content region.
 *
 * WHY A PORTAL. In the App Router the layout owns `<AppShell dock={…}>`; a child
 * page rendered as `children` cannot set that prop. Parallel-route slots could,
 * but they render as SEPARATE React subtrees — the conversation composer needs the
 * SAME engine instance the transcript uses (send / isStreaming / cancel), so it
 * must stay in the page's own tree. A portal solves both: the composer stays a
 * normal child of `<ConversationScreen>` (shares its controller via props + context)
 * while its DOM is relocated into the dock row, keyboard-safe and floating over the
 * transcript — never `position: fixed`.
 *
 * SSR RESERVATION (no CLS, no pop-in). Portals do not server-render, so the composer
 * would otherwise appear one commit after hydration and shift the transcript. To
 * hold the row's height from first paint, `<DockReservation>` renders a
 * composer-shaped skeleton — server-side too (via `usePathname`, available during
 * SSR) and ONLY on conversation routes, so no other route gains a phantom dock. When
 * a page portals real content in, it carries `data-v2-dock-content`, and a pure-CSS
 * `:has()` rule (shell.css) hides the reservation the instant that content is
 * inserted — synchronous with the DOM mutation, so there is no double-height frame
 * and no coordinating React state (hence no setState-in-effect).
 *
 * SAFE AREA. The bottom safe-area padding rides on the dock CONTENT wrappers (the
 * portal wrapper + the reservation), never on the always-present dock row — so a
 * route with no dock content (home) gains no notch strip and the row still collapses
 * to zero height.
 */
const DockHostContext = createContext<{
  host: HTMLElement | null;
  setHost: (el: HTMLElement | null) => void;
} | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const set = useCallback((el: HTMLElement | null) => setHost(el), []);
  return (
    <DockHostContext.Provider value={{ host, setHost: set }}>
      {children}
    </DockHostContext.Provider>
  );
}

/**
 * Composer-shaped skeleton — the single reservation/loading visual, shared by the
 * SSR `<DockReservation>` and a route's own "resolving" dock state (e.g. the
 * conversation screen while ownership/history load), so every transition between
 * them is seamless (identical geometry). Purely decorative.
 *
 * GEOMETRY LOCKSTEP (floating-pill round): this MUST match `ConversationComposer`'s
 * exact geometry so the SSR reservation reserves the right height and the `:has()`
 * retirement swaps to the real composer with NO CLS. The composer is now a floating
 * PILL, deliberately NARROWER than the transcript column (`max-w-xl`): the
 * jurisdiction chip (a `mb-2` meta row) FLOATS ABOVE the PromptInput card, and the
 * card (`rounded-3xl p-2`) holds ONLY the single input row (`+` button · textarea ·
 * Send), all `size-11`/`h-11` — so the skeleton mirrors exactly that
 * chip-above-a-single-row-card stack. (Width is not a CLS axis — the dock's HEIGHT is
 * what the `1fr` content row reflows against — but the skeleton tracks the pill's
 * width too so the reservation and the real bar share one silhouette.)
 */
export function ComposerSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-3 pt-2" aria-hidden>
      {/* Meta row — the jurisdiction chip, floating ABOVE the pill (mb-2, matching
          the composer's meta row). */}
      <div className="mb-2 px-1">
        <div className="bg-muted h-8 w-28 animate-pulse rounded-full" />
      </div>
      {/* The pill — the PromptInput card holding ONLY the single input row
          (+ menu · textarea · Send), matching the size-11/h-11 controls. */}
      <div className="border-border bg-muted/50 rounded-3xl border p-2">
        <div className="flex items-end gap-1.5">
          <div className="bg-muted size-11 shrink-0 animate-pulse rounded-full" />
          <div className="bg-muted h-11 flex-1 animate-pulse rounded-2xl" />
          <div className="bg-muted size-11 shrink-0 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** SSR-rendered height reservation — conversation routes only. Hidden by shell.css
 *  `:has()` the moment real portal content is inserted. */
function DockReservation() {
  const pathname = usePathname();
  const expectsDock = pathname?.startsWith('/c/') ?? false;
  if (!expectsDock) return null;
  return (
    <div data-v2-dock-reservation className="v2-safe-bottom">
      <ComposerSkeleton />
    </div>
  );
}

/**
 * The dock content host. Rendered by the layout in the AppShell `dock` slot. The
 * ref-target div (kept free of React children) is the portal target; the reservation
 * is a sibling so React never manages the same node the portal appends into.
 */
export function DockHost() {
  const ctx = useContext(DockHostContext);
  return (
    <>
      <div ref={ctx?.setHost ?? null} className="contents" />
      <DockReservation />
    </>
  );
}

/**
 * Portal a route's dock content (the floating composer, or its resolving skeleton)
 * into the shell dock row. The `data-v2-dock-content` marker is what the `:has()`
 * rule keys on to retire the SSR reservation; `v2-safe-bottom` gives the content the
 * notch clearance. Returns null until the host registers (one tick after mount).
 */
export function DockPortal({ children }: { children: ReactNode }) {
  const ctx = useContext(DockHostContext);
  if (!ctx?.host) return null;
  return createPortal(
    <div data-v2-dock-content className="v2-safe-bottom">
      {children}
    </div>,
    ctx.host,
  );
}
