'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { ConversationFrame } from '@/v2/features/conversations/conversation/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { skipRouteEntranceFor } from './route-motion';
import { V2_SHELL_CONTENT_ID } from './shell-content';

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

/** A destination's light frame. `title` is the row's own label, when it has one. */
type MoveFirstFrame = ComponentType<{ title?: string }>;

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

const MOVE_FIRST_FRAMES = {
  conversation: ConversationFrame,
  page: PageFrame,
} satisfies Record<string, MoveFirstFrame>;

export type MoveFirstKind = keyof typeof MOVE_FIRST_FRAMES;

interface PendingMove {
  href: string;
  kind: MoveFirstKind;
  title?: string;
  /** Where the content region sat at the tap; the layer covers exactly that. */
  rect: { top: number; left: number; width: number; height: number };
  /** `painting` until the navigation starts; the same transition that commits
   *  the new screen moves it to `navigating`, so the layer's last frame is the
   *  frame before the new screen's first. */
  phase: 'painting' | 'navigating';
}

type Navigate = (href: string, kind: MoveFirstKind, title?: string) => void;

const MoveFirstContext = createContext<Navigate | null>(null);

/** The path of an in-app href, for comparing with `usePathname()`. */
function pathOf(href: string): string {
  return new URL(href, window.location.href).pathname;
}

export function MoveFirstProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [navigating, startNavigation] = useTransition();

  const navigate: Navigate = (href, kind, title) => {
    const region = document.getElementById(V2_SHELL_CONTENT_ID);
    if (!region) {
      router.push(href);
      return;
    }
    const box = region.getBoundingClientRect();
    flushSync(() => {
      setPending({
        href,
        kind,
        title,
        rect: { top: box.top, left: box.left, width: box.width, height: box.height },
        phase: 'painting',
      });
    });
    // The layer already made the move; the real screen must not slide in again.
    skipRouteEntranceFor(pathOf(href));
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        startNavigation(() => {
          setPending((current) =>
            current && current.href === href ? { ...current, phase: 'navigating' } : current,
          );
          router.push(href);
        });
      }, 0);
    });
  };

  const visible = pending !== null && (pending.phase === 'painting' || navigating);

  return (
    <MoveFirstContext.Provider value={navigate}>
      {children}
      {visible && pending ? <PendingScreen move={pending} /> : null}
    </MoveFirstContext.Provider>
  );
}

function PendingScreen({ move }: { move: PendingMove }) {
  const Frame: MoveFirstFrame = MOVE_FIRST_FRAMES[move.kind] ?? PageFrame;
  return (
    <div
      className="v2-move-first fixed z-40 flex flex-col overflow-hidden bg-background"
      style={{ top: move.rect.top, left: move.rect.left, width: move.rect.width, height: move.rect.height }}
    >
      <span role="status" className="sr-only">
        {move.title ? `Opening ${move.title}` : 'Opening'}
      </span>
      <Frame title={move.title} />
    </div>
  );
}

type MoveFirstLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  kind?: MoveFirstKind;
  title?: string;
};

/** A `next/link` that moves first. Outside the v2 provider it is a plain Link. */
export function MoveFirstLink({ href, kind = 'page', title, onNavigate, ...props }: MoveFirstLinkProps) {
  const navigate = useContext(MoveFirstContext);
  const pathname = usePathname();
  return (
    <Link
      href={href}
      {...props}
      onNavigate={(event) => {
        onNavigate?.(event);
        if (!navigate || pathOf(href) === pathname) return;
        event.preventDefault();
        navigate(href, kind, title);
      }}
    />
  );
}
