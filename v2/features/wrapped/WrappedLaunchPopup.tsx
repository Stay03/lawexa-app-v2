'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { introSeenKey } from '@/v2/features/redesign-intro/model';
import { useScreenHeld } from '@/v2/runtime/screen-hold';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  WRAPPED_LAUNCH_IMAGE,
  WRAPPED_LAUNCH_TEXT,
  WRAPPED_LAUNCH_TITLE,
  wrappedLaunchSeenKey,
  wrappedLaunchShouldOpen,
} from './launch-model';
import { useHasWrapped } from './queries';

/** A beat after the first paint before the card may open, as RedesignIntro waits. */
const SETTLE_MS = 1500;

/**
 * The one-time Lawexa Wrapped launch pop-up (the rules are in
 * `launch-model.ts`), on the home only. The card is RedesignIntro's: a fixed
 * 1200 x 630 picture band with the words scrolling under it, so on a short
 * screen the buttons are never cut off.
 */
export function WrappedLaunchPopup({ introSeenOnServer }: { introSeenOnServer: boolean }) {
  const pathname = usePathname();
  const { userId } = useV2Session();
  const hasWrapped = useHasWrapped();
  const settled = useSettled();
  const seenHere = useSeen(userId, wrappedLaunchSeenKey);
  const introSeenHere = useSeen(userId, introSeenKey);
  const screenHeld = useScreenHeld();
  const [showing, setShowing] = useState(false);
  const onHome = pathname === '/' || pathname === '/v2';
  const image = useImage(WRAPPED_LAUNCH_IMAGE.src, onHome && hasWrapped && !seenHere);

  if (!onHome || userId === null || !hasWrapped || seenHere) return null;

  const open = wrappedLaunchShouldOpen({
    hasWrapped,
    userId,
    seenHere,
    introSeen: introSeenOnServer || introSeenHere,
    settled,
    screenHeld,
    showing,
    image,
  });
  const close = () => markSeen(userId);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          // Focus goes to the card, not its first button, as in RedesignIntro.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
          setShowing(true);
        }}
        className="flex flex-col gap-0 overflow-hidden p-0 outline-none sm:max-w-xl"
      >
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 1200x630 picture in public/, loaded before the card opens. */}
          <img src={WRAPPED_LAUNCH_IMAGE.src} alt={WRAPPED_LAUNCH_IMAGE.alt} width={1200} height={630} className="aspect-[1200/630] w-full object-cover" />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className={cn(
              'v2-interactive absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background',
              FOCUS_RING,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl leading-snug font-semibold text-balance">{WRAPPED_LAUNCH_TITLE}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">{WRAPPED_LAUNCH_TEXT}</DialogDescription>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={close}>
              Close
            </Button>
            <Button asChild>
              <Link href="/wrapped" onClick={close}>
                See your Wrapped <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return settled;
}

/** The picture, fetched and decoded before the card may open; never a broken card. */
function useImage(src: string, wanted: boolean): 'loading' | 'ready' | 'failed' {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    const element = new Image();
    const done = (next: 'ready' | 'failed') => {
      if (live) setStatus(next);
    };
    element.onload = () => {
      if (typeof element.decode === 'function') element.decode().then(() => done('ready'), () => done('ready'));
      else done('ready');
    };
    element.onerror = () => done('failed');
    element.src = src;
    return () => {
      live = false;
    };
  }, [src, wanted]);
  return status;
}

// ── This browser's marks ─────────────────────────────────────────────────────

const listeners = new Set<() => void>();
/** Closed in this page load, whether or not storage took the mark. */
const closedThisLoad = new Set<number>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readSeen(userId: number | null, key: (id: number) => string): boolean {
  if (userId === null) return true;
  if (key === wrappedLaunchSeenKey && closedThisLoad.has(userId)) return true;
  try {
    return window.localStorage.getItem(key(userId)) !== null;
  } catch {
    // Storage refused (a private window): not seen, so it shows once in this page load.
    return false;
  }
}

function markSeen(userId: number): void {
  closedThisLoad.add(userId);
  try {
    window.localStorage.setItem(wrappedLaunchSeenKey(userId), new Date().toISOString());
  } catch {
    // Storage refused: `closedThisLoad` keeps it shut for this page load.
  }
  for (const listener of listeners) listener();
}

function useSeen(userId: number | null, key: (id: number) => string): boolean {
  // The server snapshot is "seen": nothing is drawn before the client knows.
  return useSyncExternalStore(subscribe, () => readSeen(userId, key), () => true);
}
