'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Dock — lets a ROUTE fill the AppShell's bottom dock grid-row (grid-row 3,
 * outside the scroll container) from inside the content region.
 *
 * WHY A PORTAL. In the App Router the layout owns `<AppShell dock={…}>`; a child
 * page rendered as `children` cannot set that prop. Parallel-route slots could,
 * but they render as SEPARATE React subtrees. A portal lets a route keep its dock
 * content a normal child of its own tree (sharing state/context) while its DOM is
 * relocated into the dock row — never `position: fixed`.
 *
 * CURRENTLY UNUSED — retained mechanism. The conversation composer USED to portal
 * here as a floating dock, but the owner rejected the dock's floating-island look
 * (an opaque band above/below the pill). It now renders INSIDE the content scroll
 * region as an absolute floating layer over the transcript (see ConversationScreen),
 * so the transcript genuinely scrolls behind AND under it. With that move, no route
 * fills the dock today: the `<DockHost>` renders only its (empty) portal target, the
 * row collapses to zero height, and there is no `/c/*` SSR reservation to hold —
 * the conversation's no-CLS story is now the transcript's own reserved bottom padding
 * plus the absolute (out-of-flow) composer, so nothing here needs to reserve height.
 * The provider/host/portal stay wired so any FUTURE route that genuinely wants a
 * grid-row dock (not a floating overlay) can adopt it without re-plumbing the shell;
 * such a route would carry `data-v2-dock-content` and, if it needs one, add its own
 * SSR height reservation then.
 *
 * SAFE AREA. When a route does portal content, the bottom safe-area rides on the
 * portal CONTENT wrapper (`v2-safe-bottom`), never the always-present dock row — so
 * an empty dock gains no notch strip and still collapses to zero height.
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
 * The dock content host. Rendered by the layout in the AppShell `dock` slot. The
 * ref-target div (kept free of React children) is the portal target. No route fills
 * it today (see the header note), so the row collapses to zero height.
 */
export function DockHost() {
  const ctx = useContext(DockHostContext);
  return <div ref={ctx?.setHost ?? null} className="contents" />;
}

/**
 * Portal a route's dock content into the shell dock row. The `data-v2-dock-content`
 * marker + `v2-safe-bottom` clearance are kept for any future consumer. Returns null
 * until the host registers (one tick after mount).
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
