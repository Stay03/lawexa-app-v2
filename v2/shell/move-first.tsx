'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CaseFallbackFor, slugOf } from '@/v2/features/cases/detail/CaseFallback';
import { RouteSkeletonMark } from '@/v2/features/conversations/conversation/route-skeleton-mark';
import { ConversationFrame } from '@/v2/features/conversations/conversation/skeletons';
import { conversationIdOf, warmConversation } from '@/v2/features/conversations/warm';
import { useV2Session } from '@/v2/runtime/session-context';
import { Skeleton } from '@/components/ui/skeleton';
import {
  clearHeaderContext,
  restoreHeaderContext,
  setHeaderContext,
  snapshotHeaderContext,
  type HeaderContext,
  type HeaderSnapshot,
} from './header-context';
import { skipRouteEntranceFor } from './route-motion';
import { V2_SHELL_CONTENT_ID } from './shell-content';
import { isTopLevelRoute } from './top-level-route';

/**
 * MOVE FIRST: a tap paints the destination's light frame BEFORE any route work
 * (Stay, 8 October 2026: "all touch/click should move immediately irrespective
 * of the size of the data it has to load or render").
 *
 * WHY A LINK ALONE CANNOT. `next/link` calls `onNavigate`, then in the same task
 * `startTransition(dispatchNavigateAction)` (next/dist/client/app-dir/link.js).
 * The browser cannot paint until that task and the transition's synchronous
 * commit are done, and that commit mounts the whole new screen, its layout
 * effects included. A long chat opened from memory held the move for 1.3-2.2 s
 * that way, with no network involved (trace, 8 October 2026).
 *
 * HOW. `MoveFirstLink` prevents Next's navigation, commits the destination's
 * frame with `flushSync` in the click task, and starts the navigation after the
 * browser has painted that frame (an animation frame, then a task). The frame is
 * an opaque layer over the content region; the old screen stays mounted under
 * it, so nothing is unmounted at the tap (the list keeps its place for "back").
 * The layer shows while the navigation's transition is pending and goes when the
 * new screen commits, or when the navigation fails or is replaced, with no
 * effect that sets state.
 *
 * HOW A SCREEN OPTS IN. Add its light frame to `MOVE_FIRST_FRAMES` under a kind
 * (no data, no markdown, the screen's own geometry so the hand-off does not
 * shift), and link to it with `<MoveFirstLink kind="<its kind>">`. A link with
 * no kind gets the generic `page` frame. Modifier, middle and new-tab clicks
 * keep the browser's default: Next only calls `onNavigate` for a plain click.
 */

/** A destination's light frame. `title` is the row's own label, when it has one;
 *  `href` is where the tap is going (the router is still on the origin). */
type MoveFirstFrame = ComponentType<{ title?: string; href: string }>;

function PageFrame() {
  return (
    <div aria-hidden inert className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-6">
      <Skeleton className="h-7 w-2/3 rounded-lg" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-11/12 rounded" />
      <Skeleton className="h-4 w-4/5 rounded" />
    </div>
  );
}

/**
 * The conversation frame also counts as a conversation skeleton on screen
 * (route-skeleton-state.ts), so the screen that commits under it draws its own
 * skeleton in that same commit instead of holding it for SKELETON_HOLD_MS: the
 * region under the bar was page colour for 150-200 ms after the layer went
 * (film, 9 October 2026). The mark is the one loading.tsx renders.
 */
function ConversationMoveFrame() {
  return (
    <>
      <RouteSkeletonMark />
      <ConversationFrame />
    </>
  );
}

/**
 * A case: the case page's own loading shape (`CaseFallbackFor`), with the
 * tapped row's name in the masthead and the "Ask about this case" box at the
 * bottom, so a first tap on a case moves at once, as a chat does (Stay, 17
 * October 2026). The route's loading boundary and the page draw the same
 * shape in the same place, so the hand-off moves nothing.
 */
function CaseMoveFrame({ href }: { href: string }) {
  return <CaseFallbackFor slug={slugOf(new URL(href, window.location.href).pathname)} />;
}

const MOVE_FIRST_FRAMES = {
  conversation: ConversationMoveFrame,
  case: CaseMoveFrame,
  page: PageFrame,
} satisfies Record<string, MoveFirstFrame>;

export type MoveFirstKind = keyof typeof MOVE_FIRST_FRAMES;

interface PendingMove {
  href: string;
  kind: MoveFirstKind;
  title?: string;
  /** Where the content region sat at the tap; the layer covers exactly that.
   *  `inset` is the region's own top padding (the see-through bar's height). */
  rect: { top: number; left: number; width: number; height: number; inset: number };
  /** `painting` until the navigation starts; the same transition that commits
   *  the new screen moves it to `navigating`, so the layer's last frame is the
   *  frame before the new screen's first. */
  phase: 'painting' | 'navigating';
  /** The header as it was before the tap published the destination's, to put
   *  back when the move is cancelled by a history move. */
  restore?: HeaderSnapshot;
}

type Navigate = (
  href: string,
  kind: MoveFirstKind,
  title?: string,
  header?: HeaderContext,
  headerOwner?: string,
  onMove?: () => void,
) => void;

/**
 * A SHEET A TAP CAME FROM IS CUT, NOT CLOSED, IN THE TAP. A chat tapped in the
 * side drawer closed the drawer in the click, so the click task rendered the
 * whole drawer (twenty recent rows) and Radix measured its exit animations
 * before the frame could paint, and the closing sheet then covered the frame:
 * the frame came 155-218 ms after the tap against 60-100 ms from the list
 * (film, 10 October 2026). Now the tap sets this attribute on <html>, a v2 rule
 * in shell.css hides every sheet while it is set, and the link's `onMove`
 * (the drawer's close) runs in the task after the frame has painted. Radix sees
 * `display: none` and unmounts with no exit. The attribute lives for that one
 * task, so a sheet opened later in the move is untouched.
 *
 * THE DRAWER NO LONGER TAKES THE CUT (Stay, 22 October 2026: "the sidebar
 * closes weird"). Its chat rows pass no `onMove`: the tap only arms a close,
 * and the drawer slides away over the chat's frame once that frame has
 * painted (V2Drawer.tsx, drawer-close.ts). The cut is now the popover's and
 * the hover card's: a case citation's preview, whose "Open case" moves first.
 */
const SHEET_CUT_ATTR = 'data-v2-sheet-cut';

const MoveFirstContext = createContext<Navigate | null>(null);

/**
 * True while a move-first navigation is under way, from the task after the
 * frame was painted until the new screen commits. Links stop prefetching then:
 * the list stays mounted under the layer, and its rows' viewport prefetches
 * (8 other chats' routes on a cold reload) competed with the one route the
 * tap needs, which then took 1.4 s instead of 0.3 s (trace, 8 October 2026).
 */
const MoveFirstQuietContext = createContext(false);

/** Where a move-first tap is going while its frame shows: the destination and
 *  its frame kind, else `null`. */
export interface MoveFirstPending {
  href: string;
  kind: MoveFirstKind;
}

/**
 * The tap's destination while the move is under way, from the tap's own
 * commit until the new screen commits. The router's pathname does not change
 * in that window (the tap's history entry passes through Next untouched), so a
 * shell part that must draw for the destination from the first frame reads it
 * here: the chat's docked message box (`ChatDock`, message box B).
 */
const MoveFirstPendingContext = createContext<MoveFirstPending | null>(null);

export function useMoveFirstPending(): MoveFirstPending | null {
  return useContext(MoveFirstPendingContext);
}

/**
 * The path the shell's chrome draws for: the tap's destination while its frame
 * shows, else the router's pathname. The phone bar read the pathname alone, so
 * after a tap on a case the case's frame was on screen for the whole server
 * round trip (about 1 s on live) under the list's menu button and Lawexa mark,
 * and only then did the back arrow replace them (Stay, 20 October 2026: "the
 * lawexa logo at the top is slow to go off"). Read here, the bar and the frame
 * change in the same commit; a cancelled tap clears the destination, so the bar
 * goes back with it. Parsed against a fixed base, so it runs on the server too.
 */
export function useShownPathname(): string {
  const pathname = usePathname() ?? '';
  const pending = useContext(MoveFirstPendingContext);
  return pending ? new URL(pending.href, 'http://x').pathname : pathname;
}

/** The path of an in-app href, for comparing with `usePathname()`. */
function pathOf(href: string): string {
  return new URL(href, window.location.href).pathname;
}

/** Marks a history entry a tap pushed whose navigation has not committed yet. */
const PENDING_MOVE_KEY = '__v2PendingMove';
/** The frame kind of that tap, so a forward onto the entry draws the same frame. */
const PENDING_KIND_KEY = '__v2PendingKind';

/**
 * Where the layer goes: the whole content region, padded down by the region's
 * own top padding. On a top-level screen the region starts under a see-through
 * bar and pads itself down by the bar's height, and the list scrolls under that
 * bar. The layer covers the band too, so nothing of the list shows through it
 * (Stay, 20 October 2026, 15:09Z: "Top part of the list stays in the view case
 * page"), and its padding keeps the frame's content where the screen it opens
 * puts its own: copying the raw rect without the padding put the frame 56 px
 * too high (frame strip, 8 October 2026).
 */
function layerRect(region: HTMLElement): PendingMove['rect'] {
  const box = region.getBoundingClientRect();
  const inset = parseFloat(getComputedStyle(region).paddingTop) || 0;
  return { top: box.top, left: box.left, width: box.width, height: box.height, inset };
}

/**
 * Adds the destination's history entry in the tap. Next adds it only when the
 * new screen commits (HistoryUpdater's insertion effect, app-router.js), which
 * on a chat is 0.7 s or more after the tap. A back gesture in that window, with
 * the layer already showing the chat, went to the page before the list, and
 * left the app when the list was the first page opened (film, 9 October 2026).
 *
 * The entry carries `__NA` and the list's router tree, so Next's patched
 * pushState passes it through without touching the router, and a back move
 * pops to the list's entry, where Next restores the list and drops the pending
 * navigation. The navigation then runs as a replace, and Next's commit writes
 * the chat's state onto this entry. A second tap inside the window replaces
 * the first tap's entry instead of stacking another.
 *
 * Only Next's two fields are copied. The list's scroll key (scroll-memory.tsx)
 * must not travel: a reload or a forward onto this entry keeps custom state,
 * and the chat would then adopt the list's key and its offset.
 */
function pushPendingEntry(href: string, kind: MoveFirstKind): void {
  const state = (window.history.state ?? {}) as Record<string, unknown>;
  const entry = {
    __NA: true,
    __PRIVATE_NEXTJS_INTERNALS_TREE: state.__PRIVATE_NEXTJS_INTERNALS_TREE,
    [PENDING_MOVE_KEY]: true,
    [PENDING_KIND_KEY]: kind,
  };
  if (state[PENDING_MOVE_KEY]) window.history.replaceState(entry, '', href);
  else window.history.pushState(entry, '', href);
}

/**
 * A reload while a tap's entry was current loads the chat cold, and Next's
 * first history write keeps custom state, so the marker would stay on the
 * chat's entry and send every later forward onto it back through a re-fetch.
 * Removed once, when the provider mounts. `__NA` stays, so Next's patched
 * replaceState passes the write through.
 */
function dropLeftoverMarker(): void {
  const state = window.history.state as Record<string, unknown> | null;
  if (!state?.[PENDING_MOVE_KEY]) return;
  const rest = { ...state };
  delete rest[PENDING_MOVE_KEY];
  delete rest[PENDING_KIND_KEY];
  window.history.replaceState(rest, '', window.location.href);
}

export function MoveFirstProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [navigating, startNavigation] = useTransition();

  // Which tap a delayed router.replace belongs to: a newer tap or a history move
  // bumps it, and the replace only runs if it is still the latest.
  const tapRef = useRef(0);
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { userId } = useV2Session();

  /**
   * A chat's transcript is read from the click that raises its frame, not from
   * the screen's mount 2 s later (conversations/warm.ts). Only from a click or a
   * history move, never from a hover or a pointerdown: every read logs a view on
   * the server, and a finger that lands on a row to scroll fires no click.
   */
  const readAhead = (href: string, kind: MoveFirstKind, confidential?: boolean) => {
    if (kind !== 'conversation') return;
    const conversationId = conversationIdOf(href);
    if (conversationId) warmConversation(queryClient, { conversationId, viewerId: userId, confidential });
  };

  const visible = pending !== null && (pending.phase === 'painting' || navigating);
  // Derived, so prefetching comes back by itself when the layer goes, whether
  // the navigation landed, failed or was replaced.
  const linksQuiet = quiet && visible;
  const pendingHref = visible && pending ? pending.href : null;
  const pendingKind = visible && pending ? pending.kind : null;
  const pendingMove = useMemo<MoveFirstPending | null>(
    () => (pendingHref !== null && pendingKind !== null ? { href: pendingHref, kind: pendingKind } : null),
    [pendingHref, pendingKind],
  );

  /** Commit the destination's frame now, in this task, before any route work. */
  const raise = (
    href: string,
    kind: MoveFirstKind,
    title: string | undefined,
    region: HTMLElement,
    restore?: HeaderSnapshot,
  ) => {
    flushSync(() => {
      // Left over from the last navigation; reset here so the links do not
      // change in this commit (they go quiet after the paint, below).
      setQuiet(false);
      setPending({ href, kind, title, rect: layerRect(region), phase: 'painting', restore });
    });
    // The layer already made the move; the real screen must not slide in again.
    skipRouteEntranceFor(pathOf(href));
  };

  /**
   * Start the navigation once the frame has been painted (a frame, then a task).
   * `settle` (the cut sheet's close) runs in the same task, after the route is
   * asked for, and whatever became of the tap: a sheet hidden in the tap must
   * close even when a history move replaced it.
   */
  const navigateAfterPaint = (href: string, tap: number, settle?: () => void) => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        // Skipped when replaced by a newer tap or a history move.
        if (tapRef.current === tap) {
          // After the paint, not inside the flushSync above: re-rendering every
          // link to stop its prefetching is work the first frame must not wait on.
          setQuiet(true);
          startNavigation(() => {
            setPending((current) =>
              current && current.href === href ? { ...current, phase: 'navigating' } : current,
            );
            // Replace, not push: the tap already added the history entry.
            router.replace(href);
          });
        }
        settle?.();
      }, 0);
    });
  };

  // Every history move bumps the tap, so a pending replace from before it never
  // runs. A back move while a tap is pending: Next drops the tap's navigation
  // and restores the list, and the layer must go with it at once, not when the
  // dropped transition settles (a listener's setState, not an effect's).
  //
  // A move onto an entry a tap pushed but whose navigation was dropped (forward
  // after a back): the entry still holds the list's tree under the destination's
  // URL, so Next would restore the list there and paint a blank region under the
  // destination's bar (film, 9 October 2026). The frame is raised in this
  // listener, which runs before Next's own, so the first paint is the frame. The
  // real route is then asked for after a painted frame and a task: a navigation
  // dispatched now would be discarded by the RESTORE Next dispatches next
  // (app-router-instance.js), and by then the RESTORE has completed.
  const onPopState = useEffectEvent((event: PopStateEvent) => {
    tapRef.current += 1;
    const tap = tapRef.current;
    const state = event.state as Record<string, unknown> | null;
    const region = document.getElementById(V2_SHELL_CONTENT_ID);
    if (!state?.[PENDING_MOVE_KEY] || !region) {
      // A tap cancelled while its layer is up: the router never left the
      // origin, so the origin does not publish again and the pathname clear
      // below does not run. Its header goes back as it was before the tap.
      if (visible) {
        if (pending?.restore) restoreHeaderContext(pending.restore);
        else clearHeaderContext();
      }
      setPending(null);
      return;
    }
    const kind = state[PENDING_KIND_KEY];
    const frame = typeof kind === 'string' && kind in MOVE_FIRST_FRAMES ? (kind as MoveFirstKind) : 'page';
    const href = window.location.pathname + window.location.search;
    raise(href, frame, undefined, region);
    readAhead(href, frame);
    navigateAfterPaint(href, tap);
  });

  useEffect(() => {
    dropLeftoverMarker();
    const listener = (event: PopStateEvent) => onPopState(event);
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);

  const navigate: Navigate = (href, kind, title, header, headerOwner, onMove) => {
    const region = document.getElementById(V2_SHELL_CONTENT_ID);
    if (!region) {
      onMove?.();
      router.push(href);
      return;
    }
    tapRef.current += 1;
    const tap = tapRef.current;
    // The destination's header is published in the tap, so its bar shows the
    // title from its first frame instead of a shimmer that cross-fades later.
    // The origin's header is kept first (a second tap inside the window keeps
    // the first tap's copy), for a back move that cancels the tap.
    const restore = visible && pending?.restore ? pending.restore : snapshotHeaderContext();
    if (header) setHeaderContext(header, headerOwner);
    // Before the flush, so the frame that paints the layer has no sheet.
    if (onMove) document.documentElement.setAttribute(SHEET_CUT_ATTR, '');
    raise(href, kind, title, region, restore);
    pushPendingEntry(href, kind);
    // After the entry is pushed: a 401 on this read then sees the chat's URL and
    // does not redirect the list to /login (lib/api/client.ts).
    readAhead(href, kind, header?.confidential);
    navigateAfterPaint(
      href,
      tap,
      onMove &&
        (() => {
          // Synchronously, so the unmount and its cleanups land before the
          // attribute goes and the sheet could show for a frame.
          flushSync(onMove);
          document.documentElement.removeAttribute(SHEET_CUT_ATTR);
        }),
    );
  };

  // The tap published the destination's title, and only the destination's
  // screen clears it, when it unmounts. A back move before that screen mounted
  // (during the layer, or after the route's loading screen replaced it) left
  // the title in the store for the next screen. Top-level screens publish no
  // title, so whatever the store holds when one becomes current is stale.
  useEffect(() => {
    if (isTopLevelRoute(pathname)) clearHeaderContext();
  }, [pathname]);

  return (
    <MoveFirstContext.Provider value={navigate}>
      <MoveFirstQuietContext.Provider value={linksQuiet}>
        <MoveFirstPendingContext.Provider value={pendingMove}>
          {children}
          {visible && pending ? <PendingScreen move={pending} /> : null}
        </MoveFirstPendingContext.Provider>
      </MoveFirstQuietContext.Provider>
    </MoveFirstContext.Provider>
  );
}

function PendingScreen({ move }: { move: PendingMove }) {
  const Frame: MoveFirstFrame = MOVE_FIRST_FRAMES[move.kind] ?? PageFrame;
  return (
    <div
      className="v2-move-first fixed z-40 flex flex-col overflow-hidden bg-background"
      style={{
        top: move.rect.top,
        left: move.rect.left,
        width: move.rect.width,
        height: move.rect.height,
        paddingTop: move.rect.inset,
      }}
    >
      <span role="status" className="sr-only">
        {move.title ? `Opening ${move.title}` : 'Opening'}
      </span>
      <Frame title={move.title} href={move.href} />
    </div>
  );
}

type MoveFirstLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  kind?: MoveFirstKind;
  title?: string;
  /** The destination's header context (title, confidential), published at the tap. */
  header?: HeaderContext;
  /** Who owns that header once the destination mounts (its conversation id). */
  headerOwner?: string;
  /** The popover, hover card or sheet this link sits in closes after the frame
   *  has painted, with its exit cut (see SHEET_CUT_ATTR). On the current page,
   *  or outside the provider, it closes at once, as a plain link's onClick
   *  would. Not for a sheet that should be seen leaving: the navigation drawer
   *  arms its own close instead (drawer-close.ts). */
  onMove?: () => void;
};

/** A `next/link` that moves first. Outside the v2 provider it is a plain Link. */
export function MoveFirstLink({
  href,
  kind = 'page',
  title,
  header,
  headerOwner,
  onMove,
  onNavigate,
  prefetch,
  ...props
}: MoveFirstLinkProps) {
  const navigate = useContext(MoveFirstContext);
  const quiet = useContext(MoveFirstQuietContext);
  const pathname = usePathname();
  return (
    <Link
      href={href}
      {...props}
      prefetch={quiet ? false : prefetch}
      onNavigate={(event) => {
        onNavigate?.(event);
        if (!navigate || pathOf(href) === pathname) {
          onMove?.();
          return;
        }
        event.preventDefault();
        navigate(href, kind, title, header, headerOwner, onMove);
      }}
    />
  );
}
